# CLI Reference

The [CLI](../cli.mjs) provides a command-line interface to all browse-agent functionality:

```bash
browse-agent <command> [options]
```

## Lifecycle Commands

```bash
# Setup (install SDK + extension)
browse-agent setup
browse-agent setup --global

# Launch browser
browse-agent launch
browse-agent launch --browser edge --headless

# Check connection
browse-agent connect

# Close browser
browse-agent close

# Remove installation
browse-agent clear
browse-agent clear --global
```

## Feature Commands

Feature commands connect to an existing browser session (started with `launch`):

```bash
# Navigate
browse-agent navigate https://example.com

# Get content
browse-agent get-content --format text

# Query DOM
browse-agent get-dom "h1" --property innerText
browse-agent get-dom ".item" --property innerHTML --all

# Evaluate JS
browse-agent evaluate "document.title"

# Inject script/CSS
browse-agent inject-script "document.body.style.background = 'red'"
browse-agent inject-css "body { background: #f0f8ff }"

# Screenshot
browse-agent screenshot visible
browse-agent screenshot fullPage --format png

# Tab management
browse-agent tabs list
browse-agent tabs activate 123
browse-agent tabs close 123
```

## Options

| Option | Applies to | Description |
|---|---|---|
| `--global` | setup, clear | Use global installation (`~/.browse-agent/`) |
| `--browser <name>` | launch | Browser: `chrome` \| `chromium` \| `edge` \| `brave` |
| `--headless` | launch | Run in headless mode |
| `--port <number>` | launch, connect, feature cmds | WebSocket port (default: 9315) |
| `--tabId <id>` | all feature cmds | Target a specific tab (ID from `navigate` or `tabs list`) |
| `--format <type>` | get-content, screenshot | Content format (`text`/`html`) or screenshot format (`png`/`jpeg`) |
| `--property <prop>` | get-dom | DOM property: `outerHTML` \| `innerHTML` \| `innerText` |
| `--all` | get-dom | Return all DOM matches |
| `--quality <num>` | screenshot | JPEG quality 1-100 |
| `--timeout <ms>` | connect, feature cmds | Connection timeout in ms |
| `--help`, `-h` | all | Show help |

## Cleanup

Remove the browse-agent installation with the [clear script](../scripts/clear.mjs):

```bash
# Remove local installation (project .browse-agent/ + uninstall SDK)
browse-agent clear
```

The clear script will:
1. Kill any running browser session
2. Remove the `.browse-agent/` directory (extension, profile, session data)
3. Uninstall `browse-agent-sdk` (local mode only — global SDK is inside the removed directory)
