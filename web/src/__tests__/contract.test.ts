
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// Helpers

const repoRoot = (() => {

  if (typeof import.meta.dirname === "string") {
    return resolve(import.meta.dirname, "..", "..", "..");
  }
  // Fallback: tebak dari URL file
  const url = new URL(import.meta.url);
  const dir = url.pathname.substring(0, url.pathname.lastIndexOf("/"));
  return resolve(dir, "..", "..", "..");
})();

function readApiFile(relativePath: string): string {
  const fullPath = resolve(repoRoot, "api", relativePath);
  try {
    return readFileSync(fullPath, "utf-8");
  } catch {
    return `__FILE_NOT_FOUND:${fullPath}__`;
  }
}

function readWebFile(relativePath: string): string {
  const fullPath = resolve(repoRoot, "web", relativePath);
  try {
    return readFileSync(fullPath, "utf-8");
  } catch {
    return `__FILE_NOT_FOUND:${fullPath}__`;
  }
}

// P0-2: SkillComparison.required_level vs API expected_level 

describe("P0-2: SkillComparison field mismatch", () => {
  const frontendTypes = readWebFile("src/types/index.ts");
  const fitGapEngine = readApiFile("app/services/fit_gap/engine.rb");

  it("FRONTEND punya required_level — BUG: harusnya expected_level", () => {
    const hasRequiredLevel = /required_level/.test(frontendTypes);
    expect(hasRequiredLevel).toBe(true);   
  });

  it("FRONTEND belum punya expected_level di SkillComparison", () => {
    const skillComparisonMatch = frontendTypes.match(/interface SkillComparison[\s\S]*?^\}/m);
    expect(skillComparisonMatch).not.toBeNull();

    const skillComparisonBody = skillComparisonMatch![0];
    const hasExpectedLevel = /expected_level/.test(skillComparisonBody);
    expect(hasExpectedLevel).toBe(false); 
  });

  it("BACKENG sudah benar — kirim expected_level", () => {
    const hasExpected = /expected_level/.test(fitGapEngine);
    const hasRequired  = /required_level/.test(fitGapEngine);
    expect(hasExpected).toBe(true);
    expect(hasRequired).toBe(false);
  });
});

// P0-3: Speaker type "assessor" tidak dikenal backend 

describe("P0-3: Speaker type mismatch ('assessor' tidak dikenal backend)", () => {
  const frontendTypes = readWebFile("src/types/index.ts");
  const webSocketHook = readWebFile("src/hooks/useAudioWebSocket.ts");
  const dbSchema = readApiFile("db/schema.rb");

  it("FRONTENG masih define speaker 'assessor' — harusnya hanya 'ai'/'candidate'", () => {
    const transcriptTurnMatch = frontendTypes.match(/interface TranscriptTurn[\s\S]*?^\}/m);
    expect(transcriptTurnMatch).not.toBeNull();

    const hasAssessor = /"assessor"/.test(transcriptTurnMatch![0]);
    expect(hasAssessor).toBe(true);
  });

  it("WEBSOCKET HOOK masih mapping fallback ke 'assessor' — harusnya 'ai'", () => {
    const line = webSocketHook.match(/onTranscript\(\{[^}]*speaker[^}]*\}/);
    expect(line).not.toBeNull();

    const hasAssessorFallback = /"assessor"/.test(line![0]);
    expect(hasAssessorFallback).toBe(true);
  });

  it("DB ENUM speaker_type benar — hanya 'ai' dan 'candidate'", () => {
    const enumMatch = dbSchema.match(/create_enum "speaker_type".*?\]/);
    expect(enumMatch).not.toBeNull();

    expect(/"ai"/.test(enumMatch![0])).toBe(true);
    expect(/"candidate"/.test(enumMatch![0])).toBe(true);
    expect(/assessor/.test(enumMatch![0])).toBe(false);
  });
});

// ─── P1-1: skill_id number vs string 

describe("P1-1: skill_id — number di frontend vs string di database", () => {
  const frontendTypes = readWebFile("src/types/index.ts");
  const dbSchema = readApiFile("db/schema.rb");
  const seeds = readApiFile("db/seeds.rb");

  it("DATABASE benar — skill_id sebagai string", () => {
    const skillIdLine = dbSchema.match(/t\.(string|integer)\s+"skill_id"/);
    expect(skillIdLine).not.toBeNull();
    expect(skillIdLine![1]).toBe("string");
  });

  it("FRONTEND masih define skill_id sebagai number — harusnya string", () => {
    const assessmentSkillMatch = frontendTypes.match(/interface AssessmentSkill[\s\S]*?^\}/m);
    expect(assessmentSkillMatch).not.toBeNull();

    const body = assessmentSkillMatch![0];
    const isNumber = /skill_id\??:\s*number/.test(body);
    expect(isNumber).toBe(true);
  });

  it("SEED DATA skill_id berbentuk string — sesuai DB", () => {
    const seedSkills = seeds.match(/skill_id:\s*["'][\w-]+["']/g) || [];
    expect(seedSkills.length).toBeGreaterThan(0);
    const allStringIds = seedSkills.every((id) => /\w-\w/.test(id));
    expect(allStringIds).toBe(true);
  });
});

// P1-2: ai_level string vs integer

describe("P1-2: PortfolioSkill.ai_level — string label vs integer", () => {
  const frontendTypes = readWebFile("src/types/index.ts");
  const portfoliosController = readApiFile("app/controllers/api/v1/portfolios_controller.rb");

  it("API benar — kirim ai_level sebagai integer", () => {
    const hasIntegerReturn = /ai_level:\s+skill\.ai_level/.test(portfoliosController);
    expect(hasIntegerReturn).toBe(true);
  });

  it("FRONTEND masih define ai_level sebagai string — harusnya number", () => {
    const portfolioSkillMatch = frontendTypes.match(/interface PortfolioSkill[\s\S]*?^\}/m);
    expect(portfolioSkillMatch).not.toBeNull();

    const body = portfolioSkillMatch![0];
    const isString = /ai_level:\s*string/.test(body);
    expect(isString).toBe(true);            
  });

  it("FRONTENG punya parseLevel() — workaround yang konfirmasi mismatch", () => {
    const constants = readWebFile("src/utils/constants.ts");
    expect(/parseLevel/.test(constants)).toBe(true);
  });
});

// P1-7: CoverageMap response shape

describe("P1-7: CoverageMap response — API return shape vs frontend type", () => {
  const sessionsController = readApiFile("app/controllers/api/v1/sessions_controller.rb");
  const sessionsService = readWebFile("src/services/sessions.ts");

  it("API COVERAGE return flat object — tanpa envelope data", () => {
    const coverageBlock = sessionsController.match(/def coverage[\s\S]*?^  end/m);
    expect(coverageBlock).not.toBeNull();

    const text = coverageBlock[0];
    expect(text.includes("skills:") && text.includes("json_response(")).toBe(true);
  });

  it("FRONTEND getCoverage() pake CoverageMap langsung — valid", () => {
    const hasDirect = sessionsService.includes("api.get<CoverageMap>");
    expect(hasDirect).toBe(true);

    const hasEnvelope = sessionsService.includes("data: CoverageMap");
    expect(hasEnvelope).toBe(false);
  });
});

//  P1-4: system_prompt tidak bisa diupdate via API 

describe("P1-4: system_prompt tidak bisa diupdate via API", () => {
  const assessmentsController = readApiFile("app/controllers/api/v1/assessments_controller.rb");
  const dbSchema = readApiFile("db/schema.rb");

  it("Kolom system_prompt ADA di database", () => {
    expect(/system_prompt/.test(dbSchema)).toBe(true);
  });

  it("PERMITTED PARAMS belum include system_prompt — BUG", () => {
    const paramsBlock = assessmentsController.match(/def assessment_params[\s\S]*?^  end/m);
    expect(paramsBlock).not.toBeNull();

    const hasSystemPrompt = /:system_prompt/.test(paramsBlock[0]);
    expect(hasSystemPrompt).toBe(false);   
  });
});

// P1-6: audio_complete tanpa verifikasi coverage

describe("P1-6: audio_complete endpoint tidak verifikasi coverage", () => {
  const sessionsController = readApiFile("app/controllers/api/v1/sessions_controller.rb");

  it("ENDPOINT audio_complete tidak cek coverage — risk forced-end", () => {
    const audioComplete = sessionsController.match(/def audio_complete[\s\S]*?^  end/m);
    expect(audioComplete).not.toBeNull();

    const hasMapInjectorCall = /MapInjector|all_covered\?/.test(audioComplete[0]);
    expect(hasMapInjectorCall).toBe(false); 
  });
});

describe("P1-5: Secret di .env yang ter-commit — integritas", () => {
  it(".env.example aman — tanpa token asli", () => {
    const envExample = readWebFile(".env.example");
    expect(/eyJ/.test(envExample)).toBe(false);
  });
});
