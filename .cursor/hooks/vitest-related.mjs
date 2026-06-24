import { execSync } from "node:child_process";

let input = "";
if (!process.stdin.isTTY) {
  input = await new Response(process.stdin).text();
}

let filePath = "";
try {
  const payload = JSON.parse(input);
  filePath = payload?.tool_input?.file_path ?? "";
} catch {
  process.exit(0);
}

if (!filePath) {
  process.exit(0);
}

try {
  execSync(`npx vitest related ${JSON.stringify(filePath)} --run`, {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
} catch (error) {
  const output = [error.stdout, error.stderr].filter(Boolean).join("\n").trim();
  if (output) console.log(output);
  process.exit(2);
}
