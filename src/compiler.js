const AST = require("./ast.js");

let tabs = "";
let numTabs = 0;

const context = {
	currSourceFile: null,
	compileIndex: 0,
	flags: {
		transpiling: true
	},
	contentFunc: null
};

function compile(file, flags, contentFunc)
{
	context.contentFunc = contentFunc;
	context.compileIndex++;

	let fileResult = compileFile(file);

	if(context.flags.transpiling)
	{
		let result = "window.module = { exports: {} };\n";
		result += "window.exports = window.module.exports;\n\n";
		result += fileResult;

		context.contentFunc(file, result);
		return;
	}

	context.contentFunc(file, fileResult);
}

function compileFile(file)
{
	let result = "";

	file.compileIndex = context.compileIndex;

	let imports = file.imports;
	for(let n = 0; n < imports.length; n++) {
		let fileImport = imports[n];
		if(fileImport.compileIndex >= context.compileIndex) { continue; }

		if(contenxt.flags.concat) {
			result += compileFile(fileImport) + "\n\n";
		}
	}

	context.currSourceFile = file;

	if(context.flags.transpiling)
	{
		incTabs();

		result += "(function() ";
		result += compile_Block(file.blockNode, compileSourceExports);
		result += ")();"

		decTabs();
	}
	else {
		result += compile_Block(file.blockNode);
	}

	return result;
}

function compileSourceExports()
{
	const sourceExports = context.currSourceFile.exports;
	if(sourceExports.length === 0) { return ""; }

	let result = `exports.${context.currSourceFile.id} = { `;

	let node = sourceExports[0];
	result += getNameFromNode(node);

	for(let n = 1; n < sourceExports.length; n++) 
	{
		let node = sourceExports[n];
		result += ", " + getNameFromNode(node);
	}

	result += " };";

	return result;
}

function getNameFromNode(node)
{
	if((node instanceof AST.Function) ||
	   (node instanceof AST.Class)) 
	{
		return node.id.value;
	}
	else if(node instanceof AST.VariableDeclaration) 
	{
		const decls = node.decls;
		let declNode = decls[0];
		let result = declNode.value.value;

		for(let n = 1; n < decls.length; n++) {
			declNode = decls[n];
			result += ", " + declNode[n].value.value;
		}

		return result;
	}

	return null;
}

function compile_Identifier(node) {
	return node.value;
}

function compile_Number(node) {
	return node.value;
}

function compile_Bool(node) {
	return node.value ? "true" : "false";
}

function compile_String(node) {
	return `"${node.value}"`;
}

function compile_New(node) 
{
	let result = "new " + 
		doCompileLookup(node.callee) + 
		"(" + compile_Args(node.args) + ")";

	return result;
}

function compile_Null(node) {
	return "null";
}

function compile_Name(node)
{
	let result = "";

	const parentNode = node.parent;
	if(parentNode) 
	{
		if(parentNode.type !== "Identifier" && 
		   parentNode.type !== "Call" &&
		   parentNode.type !== "This") 
		{
			result += "(" + doCompileLookup(parentNode) + ")";
		}
		else {
			result += doCompileLookup(parentNode);
		}
	}

	if(node.computed) {
		result += "[" + doCompileLookup(node.value) + "]";
	}
	else {
		result += "." + doCompileLookup(node.value);
	}
	
	return result;
}

function compile_VariableDeclaration(node)
{
	let result = "";

	const decls = node.decls;
	for(let n = 0; n < decls.length; n++) 
	{
		let declNode = decls[n];
		let declName = doCompileLookup(declNode.value);
		result += node.kind + " " + declName;

		if(declNode.expr) {
			result += " = " + doCompileLookup(declNode.expr);
		}		
	}

	return result;
}

function compile_Array(node)
{
	const elements = node.value;
	if(elements.length === 0) { return "[]"; }

	let elementNode = elements[0];
	let result = "[ " + doCompileLookup(elementNode);

	for(let n = 1; n < elements.length; n++) {
		elementNode = elements[n];
		result += ", " + doCompileLookup(elementNode);
	}

	result += " ]";
	return result;
}

function compile_Object(node)
{
	const props = node.value;
	if(props.length === 0) { return tabs + "{}"; }

	let propsNode = props[0];
	let result = tabs + "{\n";

	incTabs();

	result += tabs + compile_ObjectMember(propsNode)

	for(let n = 1; n < props.length; n++) {
		propsNode = props[n];
		result += ",\n" + tabs + compile_ObjectMember(propsNode)
	}

	decTabs();

	result += "\n}";
	return result;
}

function compile_ObjectMember(node)
{
	let result = doCompileLookup(node.key) +
		": " + doCompileLookup(node.value);
	return result;
}

function compile_Binary(node)
{
	let result;

	if(node.left.type === "binary") {
		result = "(" + doCompileLookup(node.left) + ")";
	}
	else {
		result = doCompileLookup(node.left);
	}

	result += " " + node.op + " ";

	if(node.right.type === "binary") {
		result += "(" + doCompileLookup(node.right) + ")";
	}
	else {
		result += doCompileLookup(node.right);
	}

	return result;
}

function compile_Update(node)
{
	let result;

	if(node.prefix) {
		result = node.op + doCompileLookup(node.arg);
	}
	else {
		result = doCompileLookup(node.arg) + node.op;
	}
	
	return result;
}

function compile_Call(node)
{
	let result = doCompileLookup(node.value);
	result += "(" + compile_Args(node.args) + ")";

	return result;
}

function compile_Args(args)
{
	if(args.length === 0) { return ""; }

	let node = args[0];
	let result = doCompileLookup(node);

	for(let n = 1; n < args.length; n++) {
		node = args[n];
		result += ", " + doCompileLookup(node);
	}

	return result;
}

function compile_Function(node, withoutFunc)
{
	let funcName = doCompileLookup(node.id);

	let result = "";
	if(!withoutFunc) {
		result = "function ";
	}

	result += funcName + 
		"(" + compile_Args(node.params) + ") " +
		compile_Block(node.body);

	return result;
}

function compile_Block(node, appendFunc)
{
	incTabs();

	let blockResult = "";
	const body = node.scope.body;
	for(let n = 0; n < body.length; n++) 
	{
		let node = body[n];

		let nodeResult = doCompileLookup(node);
		if(!nodeResult) {
			continue;
		}

		if(node.type !== "Function" &&
		   node.type !== "If" && 
		   node.type !== "Switch" &&
		   node.type !== "For" &&
		   node.type !== "ForIn" &&
		   node.type !== "While" &&
		   node.type !== "DoWhile" &&
		   node.type !== "Label" &&
		   node.type !== "Try" &&
		   node.type !== "Class") 
		{
			blockResult += tabs + nodeResult + ";\n";
		}
		else {
			blockResult += tabs + nodeResult + "\n";
		}
	}

	if(appendFunc) 
	{
		let appendResult = appendFunc();
		if(appendResult) {
			blockResult += `${tabs}${appendResult}\n`;
		}
	}

	decTabs();

	if(numTabs) 
	{
		if(!blockResult) {
			return "{}";
		}
		else {
			return "{\n" + blockResult + tabs + "}";
		}
	}

	return blockResult;
}

function compile_Return(node)
{
	let result = "return " + doCompileLookup(node.arg);
	return result;
}

function compile_If(node)
{
	let result = "if(" + doCompileLookup(node.test) + ") ";

	if(node.consequent.type !== "Block") 
	{
		incTabs();
		result += doCompileLookup(node.consequent) + ";\n";
		decTabs();
	}
	else {
		result += doCompileLookup(node.consequent);
	}

	if(node.alternate)
	{
		if(node.alternate.type === "If")
		{
			result += tabs + "\nelse " + compile_If(node.alternate);
		}
		else
		{
			result += "\n" + tabs + "else ";

			if(node.alternate.type !== "Block") 
			{
				incTabs();
				result += tabs + doCompileLookup(node.alternate) + ";\n";
				decTabs();
			}
			else {
				result += tabs + doCompileLookup(node.alternate);
			}

			result += tabs;
		}
	}

	return result;
}

function compile_Conditional(node)
{
	let result = "(" + 
		doCompileLookup(node.test) + ") ? " +
		doCompileLookup(node.consequent) + " : " +
		doCompileLookup(node.alternate);

	return result;
}

function compile_Unary(node)
{
	let result;

	if(node.prefix) {
		result = node.op + " " + doCompileLookup(node.arg);
	}
	else {
		result = doCompileLookup(node.arg) + " " + node.op;
	}

	return result;
}

function compile_Switch(node)
{
	let result = "switch(" + doCompileLookup(node.discriminant) + ") {\n";

	incTabs();

	result += compile_SwitchCases(node.cases);

	decTabs();

	result += "}";

	return result;
}

function compile_SwitchCases(cases)
{
	let result = "";

	for(let n = 0; n < cases.length; n++) {
		let node = cases[n];
		result += compile_SwitchCase(node);
	}

	return result;
}

function compile_SwitchCase(node)
{
	let result = tabs;

	if(!node.test) {
		result += "default:\n";
	}
	else {
		result += "case " + doCompileLookup(node.test) + ":\n";
	}

	incTabs();

	const buffer = node.scope.body;
	for(let n = 0; n < buffer.length; n++) 
	{
		let bufferNode = buffer[n];
		if(bufferNode.type === "Block") {
			result += doCompileLookup(bufferNode);
		}
		else {
			result += tabs + doCompileLookup(bufferNode) + ";\n";
		}
	}

	decTabs();

	return result;
}

function compile_Break(node) {
	return "break";
}

function compile_For(node) 
{
	let result = "for(" + 
		doCompileLookup(node.init) + "; " +
		doCompileLookup(node.test) + "; " +
		doCompileLookup(node.update) + ") " +
		doCompileLookup(node.body);

	return result;
}

function compile_ForIn(node)
{
	let result = "for(" +
		doCompileLookup(node.left) + " in " +
		doCompileLookup(node.right) + ") " + 
		doCompileLookup(node.body);

	return result;
}

function compile_While(node)
{
	let result = "while(" +
		doCompileLookup(node.test) + ") " + 
		doCompileLookup(node.body);

	return result;
}

function compile_DoWhile(node)
{
	let result = "do " + 
		doCompileLookup(node.body) + 
		"while(" + doCompileLookup(node.test) + ")";

	return result;
}

function compile_Continue(node) {
	return "continue";
}

function compile_Label(node)
{
	let result = doCompileLookup(node.name) + ": " + 
		doCompileLookup(node.body);

	return result;
}

function compile_Sequence(node)
{
	const exprs = node.exprs;

	let exprNode = exprs[0];
	let result = doCompileLookup(exprNode);
	
	for(let n = 0; n < exprs.length; n++) {
		exprNode = exprs[n];
		result += ", " + doCompileLookup(exprNode);
	}

	return result;
}

function compile_Try(node)
{
	let result = "try " + 
		compile_Block(node.block) +
		"\n" + tabs + "catch(" + doCompileLookup(node.handler.param) + ") " +
		compile_Block(node.handler.body);

	return result;
}

function compile_Import(node) 
{
	const specifiers = node.specifiers;

	let result = "";

	if(context.flags.transpiling)
	{
		let added = false;

		for(let key in specifiers)
		{
			if(node.imported) {
				result += `const ${key} = exports.${node.sourceFile.id}`;
			}
			else 
			{
				if(!added) {
					added = true;
					result += `const ${specifiers[key]} = exports.${node.sourceFile.id}.${key}`;
				}
				else {
					result += `;\n${tabs}const ${specifiers[key]} = exports.${node.sourceFile.id}.${key}`;
				}
			}
		}
	}
	else
	{
		result += "import " +
			compile_ImportSpecifiers(node.specifiers) + 
			" from " + 
			doCompileLookup(node.source);
	}

	return result;
}

function compile_ImportSpecifiers(specifiers)
{
	let node = specifiers[0];

	if(!node.imported) {
		return doCompileLookup(node.local);
	}

	let result = "{ " + compile_ImportSpecifier(node)

	for(let n = 1; n < specifiers.length; n++) {
		node = specifiers[n];
		result += ", " + compile_ImportSpecifier(node)
	}
	
	result += " }";

	return result;
}

function compile_ImportSpecifier(node)
{
	let local = doCompileLookup(node.local);
	let imported = doCompileLookup(node.imported);
	if(local === imported) {
		return local;
	}

	return imported + " as " + local;
}

function compile_Export(node) 
{
	if(context.flags.transpiling) {
		return doCompileLookup(node.decl);
	}

	return "export " + doCompileLookup(node.decl);
}

function compile_Class(node)
{
	let result = "class " + doCompileLookup(node.id);

	if(node.superCls) {
		result += " extends " + doCompileLookup(node.superCls);
	}

	result += " {\n";

	incTabs();
	result += compile_ClassBody(node.body);
	decTabs();

	result += tabs + "}";

	return result;
}

function compile_ClassBody(node)
{
	let result = "";

	const buffer = node.buffer;
	for(let n = 0; n < buffer.length; n++) {
		let bufferNode = buffer[n];
		result += tabs + compile_MethodDef(bufferNode) + "\n";
	}

	return result;
}

function compile_MethodDef(node)
{
	const key = doCompileLookup(node.key);

	let result = key + compile_Function(node.value, true);
	return result;
}

function compile_This(node) {
	return "this";
}

function incTabs() 
{
	numTabs++;
	if(numTabs > 1) {
		tabs += "\t";
	} 
}

function decTabs() 
{
	if(numTabs > 1) {
		tabs = tabs.slice(0, -1);
	}
	numTabs--;
}

function doCompileLookup(node) {
	return node ? compileLookup[node.type](node) : "";
}

const compileLookup = {
	Identifier: compile_Identifier,
	Number: compile_Number,
	Bool: compile_Bool,
	String: compile_String,
	New: compile_New,
	Null: compile_Null,
	Name: compile_Name,
	VariableDeclaration: compile_VariableDeclaration,
	array: compile_Array,
	object: compile_Object,
	Binary: compile_Binary,
	Update: compile_Update,
	Call: compile_Call,
	Block: compile_Block,
	Function: compile_Function,
	Return: compile_Return,
	If: compile_If,
	Conditional: compile_Conditional,
	Unary: compile_Unary,
	Switch: compile_Switch,
	Break: compile_Break,
	For: compile_For,
	ForIn: compile_ForIn,
	While: compile_While,
	DoWhile: compile_DoWhile,
	Continue: compile_Continue,
	Label: compile_Label,
	Sequence: compile_Sequence,
	Try: compile_Try,
	Import: compile_Import,
	Export: compile_Export,
	Class: compile_Class,
	This: compile_This
};

module.exports = {
	compile
};
