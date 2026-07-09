import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const repoRoot = resolve(import.meta.dirname, "..", "..", "..");

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

describe("P0-2: SkillComparison field mismatch", () => {
  const frontendTypes = readWebFile("src/types/index.ts");
  const fitGapEngine = readApiFile("app/services/fit_gap/engine.rb");

  it("FRONTEND mendefinisikan required_level — harusnya expected_level", () => {
    // Frontend use 'required_level' (false)
    const hasRequiredLevel = /required_level/.test(frontendTypes);
    // Backend use 'expected_level' (true)
    const backEndUsesExpected = /expected_level/.test(fitGapEngine);

    // Assert False
    expect(hasRequiredLevel).toBe(false);
  });

  it("FRONTEND tidak mendefinisikan expected_level di SkillComparison", () => {
    const skillComparisonMatch = frontendTypes.match(/interface SkillComparison[\s\S]*?^\}/m);
    expect(skillComparisonMatch).not.toBeNull();

    const skillComparisonBody = skillComparisonMatch![0];
    const hasExpectedLevel = /expected_level/.test(skillComparisonBody);

    expect(hasExpectedLevel).toBe(true);
  });

  it("BACKEND mengirim expected_level, bukan required_level", () => {
    const hasExpectedLevelResponse = /expected_level/.test(fitGapEngine);
    const hasRequiredLevelResponse = /required_level/.test(fitGapEngine);

    expect(hasExpectedLevelResponse).toBe(true);
    expect(hasRequiredLevelResponse).toBe(false); // Backend TIDAK boleh punya required_level
  });
});

describe("P0-3: Speaker type mismatch ('assessor' tidak dikenal backend)", () => {
  const frontendTypes = readWebFile("src/types/index.ts");
  const webSocketHook = readWebFile("src/hooks/useAudioWebSocket.ts");
  const dbSchema = readApiFile("db/schema.rb");

  it("FRONTEND mendefinisikan speaker 'assessor' yang tidak ada di DB enum", () => {
    const transcriptTurnMatch = frontendTypes.match(/interface TranscriptTurn[\s\S]*?^\}/m);
    expect(transcriptTurnMatch).not.toBeNull();

    const hasAssessor = /"assessor"/.test(transcriptTurnMatch![0]);

    expect(hasAssessor).toBe(false);
  });

  it("WEBSOCKET HOOK mapping fallback ke 'assessor' bukan 'ai'", () => {
    const line = webSocketHook.match(/onTranscript\(\{[^}]*speaker[^}]*\}/);
    expect(line).not.toBeNull();

    const hasAssessorFallback = /"assessor"/.test(line![0]);
    expect(hasAssessorFallback).toBe(false);
  });

  it("DB ENUM speaker_type hanya mengizinkan 'ai' dan 'candidate'", () => {
    const enumMatch = dbSchema.match(/create_enum "speaker_type".*?\]/);
    expect(enumMatch).not.toBeNull();

    const hasAssessor = /assessor/.test(enumMatch![0]);
    expect(hasAssessor).toBe(false); // assessor TIDAK BOLEH ada di enum

    const hasAi = /"ai"/.test(enumMatch![0]);
    const hasCandidate = /"candidate"/.test(enumMatch![0]);
    expect(hasAi).toBe(true);
    expect(hasCandidate).toBe(true);
  });
});

describe("P1-1: skill_id — number di frontend vs string di database", () => {
  const frontendTypes = readWebFile("src/types/index.ts");
  const dbSchema = readApiFile("db/schema.rb");
  const seeds = readApiFile("db/seeds.rb");

  it("DATABASE mendefinisikan skill_id sebagai string, bukan integer", () => {
    const skillIdLine = dbSchema.match(/t\.(string|integer)\s+"skill_id"/);
    expect(skillIdLine).not.toBeNull();

    const typeDecl = skillIdLine![1];
    expect(typeDecl).toBe("string");
  });

  it("FRONTEND mendefinisikan skill_id sebagai number — harusnya string", () => {
    const assessmentSkillMatch = frontendTypes.match(/interface AssessmentSkill[\s\S]*?^\}/m);
    expect(assessmentSkillMatch).not.toBeNull();

    const body = assessmentSkillMatch![0];
    const isNumber = /skill_id\??:\s*number/.test(body);

    expect(isNumber).toBe(false);
  });

  it("SEED DATA skill_id berbentuk string 'SK-ENG-001', bukan number", () => {
    const seedSkills = seeds.match(/skill_id:\s*["'][\w-]+["']/g) || [];
    expect(seedSkills.length).toBeGreaterThan(0);

    const allStringIds = seedSkills.every((id) => /\w-\w/.test(id));
    expect(allStringIds).toBe(true);
  });
});

describe("P1-2: PortfolioSkill.ai_level — string label vs integer", () => {
  const frontendTypes = readWebFile("src/types/index.ts");
  const portfoliosController = readApiFile("app/controllers/api/v1/portfolios_controller.rb");

  it("API mengirim ai_level sebagai integer (langsung)", () => {
    const hasIntegerReturn = /ai_level:\s+skill\.ai_level/.test(portfoliosController);
    expect(hasIntegerReturn).toBe(true);
  });

  it("FRONTEND mendefinisikan ai_level sebagai string, bukan number", () => {
    const portfolioSkillMatch = frontendTypes.match(/interface PortfolioSkill[\s\S]*?^\}/m);
    expect(portfolioSkillMatch).not.toBeNull();

    const body = portfolioSkillMatch![0];
    const isString = /ai_level:\s*string/.test(body);

    expect(isString).toBe(false);
  });

  it("FRONTEND punya parseLevel() yang mengindikasikan ada mismatch", () => {
    const constants = readWebFile("src/utils/constants.ts");
    const hasParseLevel = /parseLevel/.test(constants);
    expect(hasParseLevel).toBe(true);
  });
});

describe("P1-7: CoverageMap response — API return shape vs frontend type", () => {
  const sessionsController = readApiFile("app/controllers/api/v1/sessions_controller.rb");
  const sessionsService = readWebFile("src/services/sessions.ts");

  it("API COVERAGE return flat object (skills, discovered) — tanpa envelope 'data'", () => {
    const coverageBlock = sessionsController.match(/def coverage[\s\S]*?^  end/m);
    expect(coverageBlock).not.toBeNull();

    const responseContent = coverageBlock[0];
    const hasSkillsKey = responseContent.includes("skills:") &&
                         responseContent.includes("json_response(");
    expect(hasSkillsKey).toBe(true);
  });

  it("FRONTEND getCoverage() pake type CoverageMap langsung tanpa envelope", () => {
    const hasCoverageMapGeneric = sessionsService.includes("api.get<CoverageMap>");
    expect(hasCoverageMapGeneric).toBe(true);

    const hasEnvelopeInCoverage = sessionsService.includes("data: CoverageMap");
    expect(hasEnvelopeInCoverage).toBe(false);
  });
});

describe("P1-4: system_prompt tidak bisa diupdate via API", () => {
  const assessmentsController = readApiFile("app/controllers/api/v1/assessments_controller.rb");
  const dbSchema = readApiFile("db/schema.rb");

  it("KOLOM system_prompt ADA di database", () => {
    expect(/system_prompt/.test(dbSchema)).toBe(true);
  });

  it("PERMITTED PARAMS tidak menyertakan system_prompt — test INI WAJIB GAGAL", () => {
    const paramsBlock = assessmentsController.match(/def assessment_params[\s\S]*?^  end/m);
    expect(paramsBlock).not.toBeNull();

    const hasSystemPrompt = /:system_prompt/.test(paramsBlock[0]);

    expect(hasSystemPrompt).toBe(true);
  });
});

describe("P1-6: audio_complete endpoint tidak verifikasi coverage", () => {
  const sessionsController = readApiFile("app/controllers/api/v1/sessions_controller.rb");

  it("ENDPOINT audio_complete tidak melakukan pengecekan coverage", () => {
    const audioComplete = sessionsController.match(/def audio_complete[\s\S]*?^  end/m);
    expect(audioComplete).not.toBeNull();

    const body = audioComplete[0];

    const hasCoverageCheck = /all_covered|coverage|map_injector/i.test(body);

    expect(hasCoverageCheck).toBe(true);
  });
});

describe("P1-5: Secret di .env yang ter-commit — integritas", () => {
  it(".env tidak boleh ada di git tracking", () => {
    const envContent = readWebFile(".env");
    const isExampleFile = envContent.startsWith("__FILE_NOT_FOUND");

    expect(isExampleFile).toBe(true);
  });

  it(".env.example harus aman (tanpa secret)", () => {
    const envExample = readWebFile(".env.example");
    const hasRealToken = /eyJ/.test(envExample);
    expect(hasRealToken).toBe(false);
  });
});
