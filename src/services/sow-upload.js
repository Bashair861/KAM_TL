import { createServerFn } from "@tanstack/react-start";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

function readEnv(name) {
  if (typeof process !== "undefined" && process.env?.[name]) return process.env[name];
  return undefined;
}

function validateSowUpload(input) {
  if (!input || typeof input !== "object") throw new Error("Invalid SOW upload payload.");
  const fileName = String(input.fileName ?? "").trim();
  const mimeType = String(input.mimeType ?? "").trim();
  const contentBase64 = String(input.contentBase64 ?? "").replace(/^data:[^,]+,/, "");
  if (!fileName) throw new Error("SOW file name is required.");
  if (!contentBase64) throw new Error("SOW file content is required.");
  const estimatedBytes = Math.ceil((contentBase64.length * 3) / 4);
  if (estimatedBytes > MAX_UPLOAD_BYTES) throw new Error("SOW file must be 12 MB or smaller.");
  return { fileName, mimeType, contentBase64 };
}

function safeExtension(fileName) {
  const match = fileName.toLowerCase().match(/\.(pdf|docx|txt|md|rtf)$/);
  return match ? `.${match[1]}` : ".txt";
}

async function runPython(candidates, args) {
  const { spawn } = await import("node:child_process");

  for (const candidate of candidates) {
    const command = candidate.command;
    const commandArgs = [...candidate.args, ...args];

    try {
      const result = await new Promise((resolve, reject) => {
        const child = spawn(command, commandArgs, { windowsHide: true });
        let stdout = "";
        let stderr = "";
        const timeout = setTimeout(() => {
          child.kill();
          reject(new Error("SOW extraction timed out."));
        }, 30_000);

        child.stdout.on("data", (chunk) => {
          stdout += chunk.toString();
        });
        child.stderr.on("data", (chunk) => {
          stderr += chunk.toString();
        });
        child.on("error", reject);
        child.on("close", (code) => {
          clearTimeout(timeout);
          if (code === 0) resolve(stdout);
          else reject(new Error(stderr || `Python exited with code ${code}.`));
        });
      });
      try {
        JSON.parse(result);
      } catch {
        throw new Error(`Python command ${command} did not return JSON.`);
      }
      return result;
    } catch (error) {
      const message = String(error?.message ?? "");
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.includes("timed out")) throw error;
      if (candidate === candidates[candidates.length - 1]) {
        const looksLikeMissingPython =
          lowerMessage.includes("not found") ||
          lowerMessage.includes("not recognized") ||
          lowerMessage.includes("did not return json") ||
          lowerMessage.includes("python exited with code 1");
        if (looksLikeMissingPython) {
          throw new Error(
            "Python 3 is not available. Install Python 3 or set SOW_PYTHON_COMMAND to the python.exe path.",
          );
        }
        throw error;
      }
    }
  }

  throw new Error("Python is not available on this machine.");
}

function normalizeExtractedFields(fields) {
  return {
    accountName: fields.accountName || null,
    arr: Number.isFinite(Number(fields.arr)) ? Number(fields.arr) : null,
    contractValue: Number.isFinite(Number(fields.contractValue))
      ? Number(fields.contractValue)
      : null,
    renewalDate: fields.renewalDate || null,
    contractType: fields.contractType || null,
    contractDuration: fields.contractDuration || null,
    textLength: Number.isFinite(Number(fields.textLength)) ? Number(fields.textLength) : 0,
  };
}

export const extractSowFields = createServerFn({ method: "POST" })
  .inputValidator(validateSowUpload)
  .handler(async ({ data }) => {
    if (typeof process === "undefined") {
      throw new Error("SOW extraction requires a server runtime with Python access.");
    }

    const [{ randomUUID }, fs, os, path] = await Promise.all([
      import("node:crypto"),
      import("node:fs/promises"),
      import("node:os"),
      import("node:path"),
    ]);

    const projectRoot = process.cwd();
    const scriptPath = path.join(projectRoot, "scripts", "extract_sow_fields.py");
    const tempDir = path.join(os.tmpdir(), "kam-tl-sow");
    const tempPath = path.join(tempDir, `${randomUUID()}${safeExtension(data.fileName)}`);
    const bytes = Buffer.from(data.contentBase64, "base64");

    await fs.mkdir(tempDir, { recursive: true });
    await fs.writeFile(tempPath, bytes);

    try {
      const preferred = readEnv("SOW_PYTHON_COMMAND");
      const localPython312 = readEnv("LOCALAPPDATA")
        ? `${readEnv("LOCALAPPDATA")}\\Programs\\Python\\Python312\\python.exe`
        : null;
      const candidates = [
        ...(preferred ? [{ command: preferred, args: [] }] : []),
        ...(localPython312 ? [{ command: localPython312, args: [] }] : []),
        { command: "python", args: [] },
        { command: "py", args: ["-3"] },
        { command: "python3", args: [] },
      ];
      const stdout = await runPython(candidates, [scriptPath, tempPath]);
      const parsed = JSON.parse(stdout);
      if (parsed.error) throw new Error(parsed.error);
      return normalizeExtractedFields(parsed);
    } finally {
      await fs.rm(tempPath, { force: true });
    }
  });
