export default {
  "*.{ts,tsx,js,jsx}": ["eslint --fix --max-warnings=999"],
  "*.{ts,tsx,js,jsx,json,md,css,yaml,yml}": [
    "prettier --write --ignore-unknown",
  ],
};
