# Contributing to Icemark

We're thrilled you're interested in contributing to Icemark. Whether you're fixing a bug, adding a feature, or improving our docs, every contribution makes Icemark smarter! To keep our community vibrant and welcoming, all members must adhere to our [Code of Conduct](CODE_OF_CONDUCT.md).

## Deciding What to Work On

Icemark welcomes any form of contribution, including but not limited to proposing new requirements, bug reports, writing documentation, developing new features, fixing bugs, etc.

All development in Icemark is based on issues: https://github.com/kakuka/icemark/issues.

## Development Setup

1. **Clone** the repo:

```sh
git clone https://github.com/kakuka/icemark.git
```

2. **Install dependencies**:

```sh
npm run install:all
```

3. **Debug**:
   Press `F5` (or **Run** → **Start Debugging**) in VSCode to open a new session with Icemark loaded.

Changes to the webview will appear immediately. Changes to the core extension will require a restart of the extension host.

Alternatively you can build a .vsix and install it directly in VSCode:

```sh
npm run build
```

A `.vsix` file will appear in the `bin/` directory which can be installed with:

```sh
code --install-extension bin/icemark-agent-<version>.vsix
```

## Writing and Submitting Code

Anyone can contribute code to Icemark, but we ask that you follow these guidelines to ensure your contributions can be smoothly integrated:

1. **Keep Pull Requests Focused**

    - Limit PRs to a single feature or bug fix
    - Split larger changes into smaller, related PRs
    - Break changes into logical commits that can be reviewed independently

2. **Code Quality**

    - Address any ESLint warnings or errors before submitting

3. **Testing**

    - Add tests for new features
    - Run `npm test` to ensure all tests pass
    - Update existing tests if your changes affect them
    - Include both unit tests and integration tests where appropriate

4. **Commit Guidelines**

    - Write clear, descriptive commit messages
    - Reference relevant issues in commits using #issue-number

5. **Before Submitting**

    - Rebase your branch on the latest main
    - Ensure your branch builds successfully
    - Double-check all tests are passing
    - Review your changes for any debugging code or console logs

6. **Pull Request Description**
    - Clearly describe what your changes do
    - Include steps to test the changes
    - List any breaking changes
    - Add screenshots for UI changes

## Contribution Agreement

By submitting a pull request, you agree that your contributions will be licensed under the same license as the project ([Apache 2.0](LICENSE)).
