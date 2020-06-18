const vscode = require('vscode');


function activate(context) {

	let baseDecoration = vscode.window.createTextEditorDecorationType({
		opacity:"0.1"
	});

	let focusDecoration = vscode.window.createTextEditorDecorationType({
		opacity:"1"
	});

	vscode.window.onDidChangeTextEditorSelection(event=>{
		triggerDecorations();
	});
	vscode.window.onDidChangeActiveTextEditor(editor=>{
		editor&&triggerDecorations();
	});

	function triggerDecorations(){
		let editor = vscode.window.activeTextEditor;
		editor.setDecorations(baseDecoration,
			[new vscode.Range(new vscode.Position(0,0),offsetPosition(editor.selection.start,-1)),
			new vscode.Range(offsetPosition(editor.selection.end,2),new vscode.Position(editor.document.lineCount,1))]);
	}

	function offsetPosition(position,offset){
		return new vscode.Position(position.line+offset,0);
	}
}
exports.activate = activate;

function deactivate() {}

module.exports = {
	activate,
	deactivate
}
