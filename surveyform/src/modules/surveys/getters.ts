import surveys from "~/surveys";
import type {
  SurveyDocument,
  ResponseDocument,
  SurveySection,
} from "@devographics/core-models";

export const getSurveyFromResponse = (response: ResponseDocument) =>
  surveys.find((s) => s.slug === response.surveySlug);

export const getSurvey = (prettySlug, year) =>
  surveys.find((s) => s.prettySlug === prettySlug && s.year === parseInt(year));

export const getSurveyBySlug = (slug?: string) =>
  surveys.find((s) => s.slug === slug);

export const getSurveyPath = ({
  survey: surveyArgument,
  number,
  response,
  home = false,
  page,
  readOnly,
}: {
  survey?: SurveyDocument | null;
  number?: any;
  response?: any;
  home?: boolean;
  page?: "thanks";
  readOnly?: boolean;
}) => {
  const survey = surveyArgument || getSurveyFromResponse(response);
  if (!survey) {
    return "";
  }
  const { year, prettySlug } = survey;
  const prefixSegment = "/survey";
  const slugSegment = prettySlug;
  const yearSegment = year;
  const pathSegments = [prefixSegment, slugSegment, yearSegment];

  if (!home) {
    if (readOnly) {
      const readOnlySegment = "read-only";
      pathSegments.push(readOnlySegment);
    } else {
      const responseSegment = response && `${response._id}`;
      pathSegments.push(responseSegment);
    }

    const suffixSegment = page || number || 1;
    pathSegments.push(suffixSegment);
  }
  const path = pathSegments.join("/");
  return path;
};

export const getSurveyTitle = ({
  survey,
  sectionTitle,
}: {
  survey: SurveyDocument;
  sectionTitle?: string;
}) => {
  const { name, year } = survey;
  let title = `${name} ${year}`;
  if (sectionTitle) {
    title += `: ${sectionTitle}`;
  }
  return title;
};

export const getSectionKey = (section: SurveySection, keyType = "title") =>
  `sections.${section.intlId || section.id}.${keyType}`;
