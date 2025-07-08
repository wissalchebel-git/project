// Define the Project interface first, as it's used in FullRecommendationDocument.
// This should accurately reflect your Project Mongoose model's fields.
export interface Project {
  _id: string; // MongoDB ObjectId for the Project document
  name: string;
  gitlabProjectId: string | number; // Corrected: Based on your controller, this can be 'N/A' (string) or a GitLab Project ID (number).
  // Add any other fields from your Project Mongoose schema that might be populated here
  description?: string; // Example: if your Project model has a description field
}

export interface AffectedVulnerability {
  name: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' | 'UNKNOWN'; // Corrected: Use specific union types for severity consistency. Added 'NONE' and 'UNKNOWN' for robustness.
  source: string;
  cve: string;
  description: string;
  package_name?: string;    // Made optional: Not all vulnerabilities might have package info (e.g., code-level findings).
  installed_version?: string; // Made optional
  fixed_version?: string;   // Made optional
}

export interface AffectedDependency {
  package_name: string;
  installed_version: string;
  fixed_version: string;
  cve: string;
  vulnerability_name: string;
  source: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' | 'UNKNOWN'; // Corrected: Use specific union types for severity consistency.
}

export interface SingleRecommendation {
  id: string; // This is the explicit 'id' field in your `singleRecommendationSchema` (due to `{_id: false}`)
  type: string;
  severity_level: string; // This could be 'Critical', 'High', etc., but your `SingleRecommendation` in Python likely sets this explicitly.
  priority: 'Immediate' | 'High' | 'Medium' | 'Low'; // Corrected: Use specific union types as per your `getPriorityClass` in dashboard.component.ts.
  summary: string;
  description: string;
  action_items: string[];
  affected_vulnerabilities?: AffectedVulnerability[]; // Optional based on rule
  affected_dependencies?: AffectedDependency[];       // Optional based on rule
  links?: {
    sonarqube_report?: string; // Optional link field
    // Add other potential links here if your Python script generates them
  };
}

export interface RecommendationSummary {
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  total_recommendations: number;
}

// This interface represents the full structure of a single Recommendation document
// as it is stored in your MongoDB and would be retrieved directly (e.g., via Mongoose .findOne() or an array from .find() ).
export interface FullRecommendationDocument {
  _id: string; // MongoDB ObjectId for the Recommendation document itself
  project: Project; // Corrected: This will be the full Project object when populated by Mongoose.
  project_name: string; // Denormalized project name, stored directly in the Recommendation document
  scan_date: string; // Date stored as an ISO 8601 string (e.g., "2024-07-08T14:30:00.000Z")
  overall_security_posture: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' | 'N/A'; // Corrected: Specific union types for overall posture.
  total_vulnerabilities: number; // The count of vulnerabilities that the recommendations address
  recommendations: SingleRecommendation[]; // The array of detailed recommendations
  summary: RecommendationSummary; // Summary of counts based on the recommendations
  error?: string; // Optional: If there was an error during the recommendation generation process
  createdAt?: string; // Optional: Mongoose automatically adds `createdAt` and `updatedAt` timestamps. These are ISO strings.
  updatedAt?: string; // Optional
  __v?: number; // Optional: Mongoose version key
}