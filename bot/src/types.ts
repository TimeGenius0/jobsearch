export interface Profile {
  personalInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    linkedin?: string;
    portfolio?: string;
    github?: string;
    website?: string;
  };
  location: {
    city: string;
    state: string;
    country: string;
    zipCode?: string;
    address?: string;
  };
  work: {
    currentTitle?: string;
    currentCompany?: string;
    yearsExperience: number;
    resumePath: string;
    coverLetterPath?: string;
  };
  education: {
    degree?: string;
    university?: string;
    graduationYear?: number;
  };
  preferences: {
    workAuthorization: string; // e.g., "US Citizen", "Green Card", "Requires Sponsorship"
    securityClearance?: string;
    willingToRelocate: boolean;
    remotePreference: "remote" | "hybrid" | "onsite" | "flexible";
    requiresVisaSponsorship: boolean;
  };
}

export interface CommonResponses {
  salaryExpectation?: string;
  availableStartDate?: string;
  referralSource?: string;
  veteranStatus?: string;
  disability?: string;
  gender?: string;
  race?: string;
}

export interface ApplicationState {
  url: string;
  company: string;
  role: string;
  platform: string;
  timestamp: string;
  screenshots: string[];
  formData: Record<string, any>;
  status: "in-progress" | "ready-to-submit" | "submitted" | "failed";
}

export interface PlatformHandler {
  detect(url: string, page: any): Promise<boolean>;
  fill(page: any, profile: Profile, responses: CommonResponses, resumeText?: string): Promise<void>;
}
