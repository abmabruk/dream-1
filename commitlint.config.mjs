export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "subject-case": [0], // allow Arabic subjects
    "subject-empty": [2, "never"],
    "type-empty": [2, "never"],
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "perf",
        "test",
        "build",
        "ci",
        "chore",
        "revert",
        "ops",
      ],
    ],
    "header-max-length": [2, "always", 100],
  },
};
