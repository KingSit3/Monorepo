// import { Entity } from './types'
import { Entity } from '@devographics/core-models'
import { Octokit } from '@octokit/core'
import fetch from 'node-fetch'
import yaml from 'js-yaml'
import { readdir, readFile } from 'fs/promises'
import last from 'lodash/last.js'
import { logToFile } from './debug'
import path from 'path'
import marked from 'marked'
import hljs from 'highlight.js/lib/common'
import { appSettings } from './settings'
import sanitizeHtml from 'sanitize-html'

let entities: Entity[] = []

// load locales if not yet loaded
export const loadOrGetEntities = async (
    options: { forceReload?: boolean } = { forceReload: false }
) => {
    const { forceReload } = options
    if (forceReload || entities.length === 0) {
        entities = await loadEntities()
    }
    return await highlightEntitiesExampleCode(parseEntitiesMarkdown(entities))
}

type MarkdownFields = "name" | "description"

const markdownFields: MarkdownFields[] = ['name', 'description']

export const parseEntitiesMarkdown = (entities: Entity[]) => {
    for (const entity of entities) {
        for (const fieldName of markdownFields) {
            const field = entity[fieldName]
            if (field) {
                const fieldHtml = marked.parseInline(field)
                const containsTagRegex = new RegExp(/(<([^>]+)>)/i)

                if (field !== fieldHtml || containsTagRegex.test(field)) {
                    entity[`${fieldName}Html`] = sanitizeHtml(fieldHtml)
                    entity[`${fieldName}Clean`] = sanitizeHtml(fieldHtml, {
                        allowedTags: []
                    })
                }
            }
        }
    }
    return entities
}

export const highlightEntitiesExampleCode = async (entities: Entity[]) => {
    for (const entity of entities) {
        const { example } = entity
        if (example) {
            const { code, language } = example
            // make sure to trim any extra /n at the end
            example.codeHighlighted = hljs.highlight(code.trim(), { language }).value
        }
    }
    return entities
}

export const loadFromGitHub = async () => {
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })
    const entities: Entity[] = []
    console.log(`-> loading entities repo`)

    const options = {
        owner: 'StateOfJS',
        repo: 'entities',
        path: ''
    }

    const contents = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', options)
    const files = contents.data as any[]

    // loop over repo contents and fetch raw yaml files
    for (const file of files) {
        const extension: string = last(file?.name.split('.')) || ''
        if (['yml', 'yaml'].includes(extension)) {
            const response = await fetch(file.download_url)
            const contents = await response.text()
            try {
                const yamlContents: any = yaml.load(contents)
                const category = file.name.replace('./', '').replace('.yml', '')
                yamlContents.forEach((entity: Entity) => {
                    const tags = entity.tags ? [...entity.tags, category] : [category]
                    entities.push({
                        ...entity,
                        category,
                        tags
                    })
                })
            } catch (error) {
                console.log(`// Error loading file ${file.name}`)
                console.log(error)
            }
        }
    }
    return entities
}

// when developing locally, load from local files
export const loadLocally = async () => {
    console.log(`-> loading entities locally`)

    const entities: Entity[] = []

    const entitiesDirPath = path.resolve(`../../${process.env.ENTITIES_DIR}/`)
    const files = await readdir(entitiesDirPath)
    const yamlFiles = files.filter((f: String) => f.includes('.yml'))

    // loop over dir contents and fetch raw yaml files
    for (const fileName of yamlFiles) {
        const filePath = entitiesDirPath + '/' + fileName
        const contents = await readFile(filePath, 'utf8')
        const yamlContents: any = yaml.load(contents)
        const category = fileName.replace('./', '').replace('.yml', '')
        yamlContents.forEach((entity: Entity) => {
            const tags = entity.tags ? [...entity.tags, category] : [category]
            entities.push({
                ...entity,
                category,
                tags
            })
        })
    }

    return entities
}

// load locales contents through GitHub API or locally
export const loadEntities = async () => {
    console.log('// loading entities')

    const entities: Entity[] =
        appSettings.loadLocalesMode === 'local' ? await loadLocally() : await loadFromGitHub()
    console.log('// done loading entities')

    return entities
}

export const initEntities = async () => {
    console.log('// initializing entities…')
    const entities = await loadOrGetEntities({ forceReload: true })
    logToFile('entities.json', entities, { mode: 'overwrite' })
}

export const getEntities = async ({
    ids,
    tag,
    tags,
    isNormalization = false
}: {
    ids?: string[]
    tag?: string
    tags?: string[]
    isNormalization?: boolean
}) => {
    let entities = await loadOrGetEntities()
    if (!isNormalization) {
        entities = entities.filter(e => !e.normalizationOnly)
    }
    if (ids) {
        entities = entities.filter(e => ids.includes(e.id))
    }
    if (tag) {
        entities = entities.filter(e => e.tags && e.tags.includes(tag))
    }
    if (tags) {
        entities = entities.filter(e => tags.every(t => e.tags && e.tags.includes(t)))
    }
    return entities
}

export const findEntity = (id: string, entities: Entity[]) =>
    entities.find(e => {
        return (
            (e.id && e.id.toLowerCase() === id) ||
            (e.id && e.id.toLowerCase().replace(/\-/g, '_') === id) ||
            (e.name && e.name.toLowerCase() === id)
        )
    })

export const getEntity = async ({ id }: { id: string | number }) => {
    if (!id || typeof id !== 'string') {
        return
    }

    const entities = await getEntities({})

    const entity = findEntity(id.toLowerCase(), entities)

    if (!entity) {
        return
    }
    
    if (entity.belongsTo) {
        // if entity A belongs to another entity B, extend B with A and return the result
        const ownerEntity = findEntity(entity.belongsTo, entities)
        return { ...ownerEntity, ...entity }
    } else {
        return entity
    }
}