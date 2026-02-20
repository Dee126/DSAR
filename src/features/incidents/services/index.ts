/**
 * Incident services — business logic layer.
 * Currently re-exports from repositories. As business logic grows
 * (e.g. validation, multi-step orchestration), add service functions here
 * that call repositories internally.
 */
export {
  fetchIncident,
  fetchSystems,
  updateIncident,
  postIncidentAction,
  searchDsarCases,
  linkDsarToIncident,
  unlinkDsarFromIncident,
  createSurgeGroup,
  generateExport,
  getExportDownloadUrl,
} from "../repositories";
