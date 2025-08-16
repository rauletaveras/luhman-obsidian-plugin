# Build Guide

## Prerequisites

- **Node.js 18+** (recommended: use latest LTS)
- **npm** (comes with Node.js)

Check your versions:
```bash
node --version    # Should be 18+
npm --version     # Should be 8+
```

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Development (with auto-rebuild):**
   ```bash
   npm run dev
   ```
   This watches for file changes and rebuilds automatically.

3. **Production build:**
   ```bash
   npm run build
   ```

## Available Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development with file watching |
| `npm run build` | Build for production |
| `npm run typecheck` | Check TypeScript types only |
| `npm run lint` | Fix linting issues automatically |
| `npm run lint:check` | Check for linting issues (no fixes) |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |
| `npm run clean` | Remove build artifacts |

## Development Workflow

1. **Start development mode:**
   ```bash
   npm run dev
   ```

2. **Make your changes** in the `src/` directory

3. **The build will auto-update** - check for errors in the terminal

4. **Before committing:**
   ```bash
   npm run lint        # Fix any style issues
   npm run typecheck   # Ensure no type errors
   ```

## Project Structure

```
src/
├── main.ts              # Main plugin entry point
├── id-utils.ts          # ID generation and parsing
├── note-service.ts      # Business logic
├── template-service.ts  # Template processing
├── file-operations-service.ts # File I/O operations
├── settings-tab.ts      # Settings UI
├── modals.ts           # User dialogs
├── types.ts            # TypeScript type definitions
└── styles/
    └── styles.css      # Plugin styling
```

## Build Output

- `main.js` - The bundled plugin code
- `styles.css` - Compiled CSS
- `manifest.json` - Plugin metadata (not built, but required)

## Common Issues

### "Cannot find module 'obsidian'"
This is normal during development. The `obsidian` module is provided by Obsidian itself.

### TypeScript errors about missing types
Run `npm install` to ensure all dependencies are installed.

### Build fails with "rollup" errors
1. Try `npm run clean` then `npm run build`
2. If still failing, delete `node_modules` and run `npm install`

### ESLint complaining about code style
Run `npm run lint` to auto-fix most issues.

## Testing in Obsidian

1. Build the plugin: `npm run build`
2. Copy the entire folder to your Obsidian vault's `.obsidian/plugins/` directory
3. Enable the plugin in Obsidian settings

## Releasing

1. Update version in `package.json` and `manifest.json`
2. Update `CHANGELOG.md`
3. Run `npm run build` to ensure it builds cleanly
4. Commit and tag the release

## Modernization Notes

This build setup uses:
- **esbuild** - The modern standard for Obsidian plugins (much faster than Rollup)
- **TypeScript 5.5+** with strict mode enabled
- **Modern ESLint** with TypeScript support
- **Prettier** for consistent formatting
- **Up-to-date dependencies** (as of 2024)

The configuration prioritizes:
- **Maintainability**: Clear scripts and consistent tooling
- **Developer experience**: Fast rebuilds and helpful error messages
- **Type safety**: Strict TypeScript settings to catch errors early
- **Code quality**: Automated linting and formatting
