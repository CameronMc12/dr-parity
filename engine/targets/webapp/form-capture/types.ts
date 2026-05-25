/**
 * Form-capture plan types. A "plan" is a YAML file describing forms in the
 * target webapp and the scenarios we want recorded responses for
 * (validation errors, success cases, etc.).
 */

export type FormScenario = {
  name: string;
  inputs: Record<string, string>;
};

export type FormDefinition = {
  name: string;
  route: string;
  selector: string;
  submitTrigger: string;
  scenarios: FormScenario[];
};

export type FormPlan = {
  forms: FormDefinition[];
};

export type CapturedFormResponse = {
  formName: string;
  scenarioName: string;
  request: {
    method: string;
    url: string;
    postData: string | null;
  };
  response: {
    status: number;
    body: string | null;
    headers: Record<string, string>;
  };
  capturedAt: string;
};

export type FormCaptureOptions = {
  appUrl: string;
  planPath: string;
  outDir: string;
  userDataDir: string;
  dryRun: boolean;
};
