import { execSync } from "node:child_process";

if (!process.stdin.isTTY) {
  await new Response(process.stdin).text();
}

try {
  execSync("npx eslint --fix . --quiet", {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
} catch (error) {
  const output = [error.stdout, error.stderr].filter(Boolean).join("\n").trim();
  if (output) console.log(output);
  process.exit(2);
}
