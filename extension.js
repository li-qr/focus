const vscode = require('vscode');
const { POINT_CONVERSION_COMPRESSED } = require('constants');


const CONF_OPACITY = "focus.opacity";
const CONF_HIGHLIGHT_RANGE = "focus.highlightRange";
const CONF_HIGHLIGHT_RANGE_LINE = "line";
const CONF_HIGHLIGHT_RANGE_BLOCK = "block";
const CONF_HIGHLIGHT_RANGE_INDENT = "indent";
const CONF_HIGHLIGHT_RANGE_FIXED = "fixed";
const CONF_HIGHLIGHT_LINES = "focus.highlightLines";

const CMD_TO_LINE = "focus.swtichToLineLevel";
const CMD_TO_FIXED = "focus.switchToFixedLevel";
const CMD_TO_INDENT = "focus.switchToIndentLevel";
const CMD_TO_BLOCK = "focus.switchToBlockLevel";
const CMD_TOGGLE = "focus.focus.toggleLevel";

function activate(context) {

    let baseDecoration = vscode.window.createTextEditorDecorationType({
        opacity: vscode.workspace.getConfiguration().get(CONF_OPACITY)
    });

    vscode.window.onDidChangeTextEditorSelection(event => {
        triggerUpdateDecorations();
    });

    vscode.window.onDidChangeActiveTextEditor(editor => {
        editor && triggerUpdateDecorations();
    });

    vscode.workspace.onDidChangeConfiguration(listener => {
        if (listener.affectsConfiguration(CONF_OPACITY)) {
            baseDecoration.dispose();
            baseDecoration = vscode.window.createTextEditorDecorationType({
                opacity: vscode.workspace.getConfiguration().get(CONF_OPACITY)
            });
        }
        (listener.affectsConfiguration(CONF_OPACITY)
            || listener.affectsConfiguration(CONF_HIGHLIGHT_LINES)
            || listener.affectsConfiguration(CONF_HIGHLIGHT_RANGE))
            && vscode.window.activeTextEditor
            && triggerUpdateDecorations();
    });

    let timeout = null;
    function triggerUpdateDecorations() {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(updateDecorations, 100);
    }

    function updateDecorations() {
        let activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) return;
        const ROLL_ABOVE = -1;
        const ROLL_BELOW = 1;
        let range = [];
        let selections = activeEditor.selections.sort((a, b) => a.start.line - b.start.line);
        let rangeType = vscode.workspace.getConfiguration().get(CONF_HIGHLIGHT_RANGE);
        switch (rangeType) {
            case CONF_HIGHLIGHT_RANGE_LINE:
                lineDecoration();
                break;
            case CONF_HIGHLIGHT_RANGE_BLOCK:
                rangeDecoration();
                break;
            case CONF_HIGHLIGHT_RANGE_INDENT:
                indentDecoration();
                break;
            case CONF_HIGHLIGHT_RANGE_FIXED:
                let lineCount = vscode.workspace.getConfiguration().get(CONF_HIGHLIGHT_LINES) / 2;
                fixedDecoration(lineCount);
                break;
        };
        activeEditor.setDecorations(baseDecoration, range);

        function rangeDecoration() {
            const TOKEN_BASE = 1;
            const TOKEN = ['{', '', '}'];
            rollDecoration((position, type) => {
                return position;
            }, (position, type) => {
                var stack = 0;
                for (var line = position.line; line > -1 && line < activeEditor.document.lineCount; line += type) {
                    let lineString = activeEditor.document.lineAt(line).text;
                    for (var char = line == position.line ? position.character : (type == ROLL_ABOVE ? lineString.length : 0);
                        char > -1 && char <= lineString.length; char += type) {
                        let charS = lineString.charAt(char);
                        if (charS == TOKEN[TOKEN_BASE - type]
                            && !(line == position.line && char == position.character)) {
                            stack++;
                        }
                        if (charS == TOKEN[TOKEN_BASE + type]) {
                            if (stack == 0) {
                                return new vscode.Position(line, type == ROLL_BELOW ? char + 1 : char);
                            } else {
                                stack--;
                            }
                        }
                    }
                }
                return new vscode.Position(type == ROLL_ABOVE ? 0 : activeEditor.document.lineCount, 0);
            });
        };

        function indentDecoration() {
            rollDecoration(offsetPosition, (position, type) => {
                let tabs = " ".repeat(activeEditor.options.tabSize);
                let lineString = activeEditor.document.lineAt(position.line).text.replace(/\t/g, tabs);
                let indent = lineString.search("\\S");
                let l = position.line;
                for (var i = indent; i >= indent && l > -1 && l < activeEditor.document.lineCount; l += type) {
                    i = activeEditor.document.lineAt(l).text.replace(/\t/g, tabs).search("\\S");
                }
                return new vscode.Position(l - type * 2, 0);
            });
        };

        function rollDecoration(p, r) {
            for (let i = 0; i < selections.length; i++) {
                if (i == 0) {
                    range.push(new vscode.Range(
                        new vscode.Position(0, 0),
                        p(r(selections[i].start, ROLL_ABOVE), 0)));
                } else {
                    firstPosition = r(selections[i - 1].end, ROLL_BELOW);
                    nextPosition = r(selections[i].start, ROLL_ABOVE);
                    if (nextPosition.isAfter(firstPosition)) {
                        range.push(new vscode.Range(
                            p(firstPosition, 1),
                            p(nextPosition, 0)
                        ));
                    }
                }
                if (i == selections.length - 1) {
                    range.push(new vscode.Range(
                        p(r(selections[i].end, ROLL_BELOW), 1),
                        new vscode.Position(activeEditor.document.lineCount, 1)
                    ));
                }
            }
        };

        function lineDecoration() {
            fixedDecoration(0);
        };

        function fixedDecoration(lineCount) {
            for (let i = 0; i < selections.length; i++) {
                if (i == 0) {
                    range.push(new vscode.Range(
                        new vscode.Position(0, 0),
                        offsetPosition(selections[i].start, -lineCount)));
                } else if (selections[i].start.line - lineCount > selections[i - 1].end.line + lineCount + 1) {
                    range.push(new vscode.Range(
                        offsetPosition(selections[i - 1].end, lineCount + 1),
                        offsetPosition(selections[i].start, -lineCount)));
                }
                if (i == selections.length - 1) {
                    range.push(new vscode.Range(
                        offsetPosition(selections[i].end, lineCount + 1),
                        new vscode.Position(activeEditor.document.lineCount, lineCount + 1)));
                }
            }
        };
    };

    function offsetPosition(position, offset) {
        return new vscode.Position(position.line + offset, 0);
    };

    vscode.commands.registerCommand(CMD_TO_LINE, () => {
        vscode.workspace.getConfiguration().update(CONF_HIGHLIGHT_RANGE, CONF_HIGHLIGHT_RANGE_LINE, vscode.ConfigurationTarget.Global);
    });
    vscode.commands.registerCommand(CMD_TO_BLOCK, () => {
        vscode.workspace.getConfiguration().update(CONF_HIGHLIGHT_RANGE, CONF_HIGHLIGHT_RANGE_BLOCK, vscode.ConfigurationTarget.Global);
    });
    vscode.commands.registerCommand(CMD_TO_INDENT, () => {
        vscode.workspace.getConfiguration().update(CONF_HIGHLIGHT_RANGE, CONF_HIGHLIGHT_RANGE_INDENT, vscode.ConfigurationTarget.Global);
    });
    vscode.commands.registerCommand(CMD_TO_FIXED, () => {
        vscode.workspace.getConfiguration().update(CONF_HIGHLIGHT_RANGE, CONF_HIGHLIGHT_RANGE_FIXED, vscode.ConfigurationTarget.Global);
    });
    vscode.commands.registerCommand(CMD_TOGGLE, () => {
        switch (vscode.workspace.getConfiguration().get(CONF_HIGHLIGHT_RANGE)) {
            case CONF_HIGHLIGHT_RANGE_BLOCK:
                vscode.commands.executeCommand(CMD_TO_LINE);
                break;
            case CONF_HIGHLIGHT_RANGE_LINE:
                vscode.commands.executeCommand(CMD_TO_FIXED);
                break;
            case CONF_HIGHLIGHT_RANGE_FIXED:
                vscode.commands.executeCommand(CMD_TO_INDENT);
                break;
            case CONF_HIGHLIGHT_RANGE_INDENT:
                vscode.commands.executeCommand(CMD_TO_BLOCK);
                break;
        };
        updateStatusBarItem();
    });

    let statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusItem.command = CMD_TOGGLE;
    statusItem.tooltip="Toggle Focus Level";
    vscode.window.onDidChangeActiveTextEditor(() => updateStatusBarItem());
    vscode.window.onDidChangeTextEditorSelection(() => updateStatusBarItem());
    updateStatusBarItem();

    function updateStatusBarItem() {
        statusItem.hide();
        switch (vscode.workspace.getConfiguration().get(CONF_HIGHLIGHT_RANGE)) {
            case CONF_HIGHLIGHT_RANGE_BLOCK:
                statusItem.text = `Focus:$(json)`;
                break;
            case CONF_HIGHLIGHT_RANGE_LINE:
                statusItem.text = `Focus:$(diff-remove)`;
                break;
            case CONF_HIGHLIGHT_RANGE_FIXED:
                statusItem.text = `Focus:$(find-selection)`;
                break;
            case CONF_HIGHLIGHT_RANGE_INDENT:
                statusItem.text = `Focus:$(tree-filter-on-type-on)`;
                break;
        }
        statusItem.show();
    }
}
exports.activate = activate;

function deactivate() { }

module.exports = {
    activate,
    deactivate
}
