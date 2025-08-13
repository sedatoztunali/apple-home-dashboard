# Contributing to Apple Home Dashboard

First off, thanks for taking the time to contribute! 🎉

All types of contributions are encouraged and valued. See the [Table of Contents](#table-of-contents) for different ways to help and details about how this project handles them.

Please make sure to read the relevant section before making your contribution. It will make it a lot easier for us maintainers and smooth out the experience for all involved. The community looks forward to your contributions! 

> If you like the project but don't have time to contribute, that's fine too! There are other easy ways to support the project and show your appreciation:
>
> - ⭐ Star the project
> - 🐦 Tweet about it  
> - 📖 Refer to this project in your readme
> - 💬 Mention the project at local meetups and tell your friends/colleagues
> - ☕ [Buy us a coffee](https://buymeacoffee.com/applehome) (if sponsorship is available)

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [I Have a Question](#i-have-a-question)
- [I Want To Contribute](#i-want-to-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Code Contribution](#code-contribution)
- [Development Setup](#development-setup)
- [Style Guides](#style-guides)
  - [Code Style](#code-style)
  - [Commit Messages](#commit-messages)

---

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

---

## I Have a Question

> **Note:** Before you ask a question, please read the [README](README.md) and search for existing [Issues](../../issues) that might help you.

Before asking a question, it's best to search for existing issues or discussions that might help you. In case you found a suitable issue and still need clarification, you can write your question in that issue.

If you still feel the need to ask a question and need clarification, we recommend the following:

- Open a new [issue](../../issues/new/choose)
- Provide as much context as you can about what you're running into
- Provide project and platform versions (Home Assistant, browser, etc), depending on what seems relevant

We will then take care of the issue as soon as possible.

---

## I Want To Contribute

> **Legal Notice:** When contributing to this project, you must agree that you have authored 100% of the content, that you have the necessary rights to the content, and that the content you contribute may be provided under the project license.

### Reporting Bugs

#### Before Submitting a Bug Report

A good bug report shouldn't leave others needing to chase you up for more information. Therefore, we ask you to investigate carefully, collect information, and describe the issue in detail in your report.

Please complete the following steps in advance to help us fix any potential bug as fast as possible:

- Make sure that you are using the latest version
- Determine if your bug is really a bug and not an error on your side (e.g., using incompatible Home Assistant version)
- Check if there is not already a bug report existing for your bug or error in the [bug tracker](../../labels/bug)
- Collect information about the bug:
  - Stack trace (if applicable)
  - Home Assistant version
  - Browser and version
  - Device type (mobile, desktop, tablet)
  - Apple Home Dashboard version
  - Dashboard configuration
  - Console errors from browser developer tools
  - Can you reliably reproduce the issue?

#### How Do I Submit a Good Bug Report?

> **Important:** You must never report security related issues, vulnerabilities or bugs including sensitive information to the issue tracker, or elsewhere in public. Instead sensitive bugs must be sent by email to the project maintainers.

We use GitHub issues to track bugs and errors. If you run into an issue with the project:

- Open an [Issue](../../issues/new/choose) and select the "Bug report" template
- Explain the behavior you would expect and the actual behavior
- Please provide as much context as possible and describe the *reproduction steps* that someone else can follow to recreate the issue
- Provide the information you collected in the previous section

Once it's filed:

- The project team will label the issue accordingly
- A team member will try to reproduce the issue with your provided steps
- If the team is able to reproduce the issue, it will be marked as a bug and left to be implemented by someone

### Suggesting Enhancements

This section guides you through submitting an enhancement suggestion for Apple Home Dashboard, **including completely new features and minor improvements to existing functionality**. Following these guidelines will help maintainers and the community to understand your suggestion and find related suggestions.

#### Before Submitting an Enhancement

- Make sure that you are using the latest version
- Read the [README](README.md) carefully and find out if the functionality is already covered
- Search the [issues](../../issues) to see if the enhancement has already been suggested. If it has, add a comment to the existing issue instead of opening a new one
- Find out whether your idea fits with the scope and aims of the project (Apple Home design consistency)

#### How Do I Submit a Good Enhancement Suggestion?

Enhancement suggestions are tracked as [GitHub issues](../../issues).

- Use the **"Feature request"** template when creating the issue
- Use a **clear and descriptive title** for the issue to identify the suggestion
- Provide a **step-by-step description of the suggested enhancement** in as many details as possible
- **Describe the current behavior** and **explain which behavior you expected to see instead** and why
- **Explain why this enhancement would be useful** to most Apple Home Dashboard users
- You may want to **include screenshots or mockups** which help you demonstrate the feature or point out the part which the suggestion is related to

### Code Contribution

#### Development Setup

See the [Development Setup](#development-setup) section below for detailed instructions on setting up your development environment.

#### Pull Request Process

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes following our [style guides](#style-guides)
4. Test your changes thoroughly
5. Update the README.md if needed
6. Ensure the build passes (`npm run build`)
7. Create a pull request with a clear title and description

---

## Development Setup

### Prerequisites

- **Node.js** 18 or later
- **npm** (comes with Node.js)
- **Home Assistant** instance for testing

### Setup Steps

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/nitaybz/apple-home-dashboard.git
   cd apple-home-dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Development workflow**
   ```bash
   # Start development build with watch mode
   npm run build:dev
   
   # Build for production
   npm run build
   
   # Deploy to your Home Assistant (configure deploy.sh first)
   npm run deploy
   
   # Run linting
   npm run lint
   
   # Fix linting issues automatically
   npm run lint:fix
   
   # Format code with Prettier
   npm run format
   ```

4. **Testing your changes**
   - The `deploy.sh` script builds and deploys to your Home Assistant
   - Configure the Home Assistant host in `deploy.sh` before first use
   - Test on multiple screen sizes and devices

### Project Structure

```
src/
├── apple-home-strategy.ts      # Main entry point
├── components/                 # UI components
├── config/                     # Configuration management
├── pages/                      # Page components
├── sections/                   # Section components  
├── types/                      # TypeScript type definitions
└── utils/                      # Utility functions
```

---

## Style Guides

### Code Style

This project uses ESLint and Prettier for consistent code formatting:

- **Indentation**: 2 spaces
- **Quotes**: Single quotes for JavaScript/TypeScript, double quotes for JSON
- **Semicolons**: Always use semicolons
- **Line length**: Maximum 120 characters
- **Trailing commas**: Use ES5-style trailing commas

Run `npm run lint` to check your code and `npm run format` to format it automatically.

### TypeScript Guidelines

- Use TypeScript for all new code
- Define proper interfaces and types
- Avoid `any` type when possible
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

### CSS Guidelines

- Follow BEM naming convention where applicable
- Use CSS custom properties for theming
- Prefer flexbox and grid for layouts
- Write mobile-first responsive styles
- Keep styles scoped to components

### Commit Messages

We follow the [Conventional Commits](https://conventionalcommits.org/) specification:

- **feat**: A new feature
- **fix**: A bug fix  
- **docs**: Documentation changes
- **style**: Code style changes (formatting, missing semicolons, etc)
- **refactor**: Code changes that neither fix a bug nor add a feature
- **test**: Adding missing tests or correcting existing tests
- **chore**: Changes to build process, dependencies, etc

Examples:
```
feat: add support for fan entities in dashboard
fix: resolve card flickering on state changes  
docs: update installation instructions
style: format code with prettier
```

---

## Recognition

Contributors will be recognized in our README and release notes. We appreciate all contributions, no matter how small!

Thank you for helping make Apple Home Dashboard better! 🏠✨
