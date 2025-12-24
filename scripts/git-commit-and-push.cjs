#!/usr/bin/env node
const { execSync } = require("child_process");

function run(cmd) {
  return execSync(cmd, { stdio: "pipe" }).toString().trim();
}

try {
  const commitMsg = process.argv[2] || "chore: update codebase";
  const status = run("git status --porcelain");
  if (!status) {
    console.log("No changes to commit.");
    process.exit(0);
  }

  console.log("Staging changes...");
  run("git add -A");

  console.log("Creating commit...");
  run(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`);

  console.log("Pushing to origin...");
  const branch = run("git rev-parse --abbrev-ref HEAD");
  run(`git push origin ${branch}`);

  console.log("✅ Changes pushed successfully.");
} catch (err) {
  console.error("❌ Git push failed:", err.message || err);
  process.exit(1);
}
