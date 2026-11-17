# Markdown Document Reader

A calm, document-style Markdown reader for Visual Studio Code. It gives `.md` files a clean reading surface while keeping the preview synchronized with edits.

## Features

- Document-style typography that follows your VS Code color theme
- Live preview updates while you edit
- Automatic table of contents for headings
- Adjustable font size and page width
- Local and remote image support
- Responsive layout for narrow editor groups
- Keyboard-accessible reading controls
- Raw HTML disabled for safer previews

## Use

Open a Markdown file, then use any of these options:

- Click the **Open Document Preview to the Side** icon in the editor title bar.
- Right-click a `.md` file in Explorer and choose **Open Document Preview**.
- Open the Command Palette and run **Markdown Reader: Open Document Preview**.
- Press `Ctrl+K V` on Windows/Linux or `Cmd+K V` on macOS.

Use the preview toolbar to show or hide the table of contents, change the text size, or cycle between narrow, comfortable, and wide page layouts.

## Development

```bash
npm install
npm run check
```

Press `F5` in VS Code to launch an Extension Development Host. Open a Markdown file there and run the preview command.

To create an installable `.vsix` package:

```bash
npm run package
```

## Settings

- `markdownDocumentReader.defaultWidth`
- `markdownDocumentReader.defaultFontSize`
- `markdownDocumentReader.showTableOfContents`

## License

MIT
