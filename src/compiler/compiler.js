const AST = require("./ast.js")
const path = require("path")
const utils = require("./utils")
const logger = require("../logger")

let tabs = "";
let numTabs = 0;

const context = {
	currSourceFile: null,
	compileIndex: 0,
	flags: null
};

const requirements = {
	inherits: false
};

const clsCtx = {
	inside: false,
	insideConstr: false,
	id: null,
	superCls: null
};

function genRequirementResult(modulesPath)
{
	return `(function(scope) {
	scope.module = { exports: {} };
	scope.modules = {};
	scope.modulesCached = {};
	scope.modulesPath = ${modulesPath};
	scope.process = {
		env: {
			NODE_ENV: "dev"
		}
	};

	scope._inherits = function(a, b)
	{
		var protoA = a.prototype;
		var proto = Object.create(b.prototype);

		for(var key in protoA)
		{
			var param = Object.getOwnPropertyDescriptor(protoA, key);
			if(param.get || param.set) {
				Object.defineProperty(proto, key, param);
			}
			else {
				proto[key] = protoA[key];
			}
		}

		a.prototype = proto;
		a.prototype.constructor = a;

		if(b.__inherit === undefined) {
			b.__inherit = {};
		}

		b.__inherit[a.name] = a;
	}
})(window || global);\n\n`;
}

function genModulePaths()
{
	let result = "";

	const modules = context.flags.modules;
	for(const key in modules)
	{
		const module = modules[key];

		let modulePath = path.relative(process.cwd(), module.path).replace(/\\/g,"/");
		if(modulePath[0] !== ".") {
			modulePath = "./" + modulePath;
		}
		modulePath = modulePath.toLowerCase();

		result += ` "${key}":"${modulePath}",`;
	}

	return `{${result} }`;
}

function compile(file, flags)
{
	if(!flags)
	{
		flags = {
			type: "content"
		}
	}

	context.flags = flags;
	context.compileIndex++;

	switch(flags.type)
	{
		case "imports":
			return compileImports(file);

		case "content":
			return compileFile(file);
	}
}

function compileFile(file)
{
	if(context.flags.needModule && context.flags.transpiling)
	{
		let result = `"use strict";\n\n`;
		result += genRequirementResult(genModulePaths());
		result += compileContent(file, true);
		return result;
	}

	let result = compileContent(file, false);
	return result;
}

function compileContent(file, needModule)
{
	let result = "";

	file.compileIndex = context.compileIndex;

	if(context.flags.concat)
	{
		let imports = file.imports;
		for(let n = 0; n < imports.length; n++)
		{
			let fileImport = imports[n];
			if(fileImport.compileIndex >= context.compileIndex) {
				continue;
			}

			if(!fileImport.blockNode) {
				continue;
			}

			result += compileContent(fileImport) + "\n\n";
		}
	}

	context.currSourceFile = file;

	if(context.flags.transpiling)
	{
		incTabs();

		if(!needModule) {
			result += `"use strict";\n\n`;
		}

		const relativePath = path.relative(process.cwd(), file.fullPath).replace(/\\/g,"/");

		result += `(function() `;
		result += compile_Block(file.blockNode, compileSourceExports);
		result += ")();\n\n"
		result += `//# sourceURL=${relativePath}`

		decTabs();
	}
	else {
		result += compile_Block(file.blockNode);
	}

	return result;
}

function compileImports(file)
{
	context.compileIndex++;

	let imports = [];
	gatherImports(file, imports);

	return imports;
}

function gatherImports(file, buffer)
{
	const imports = file.imports;
	if(imports.length === 0) { return; }

	for(let n = 0; n < imports.length; n++)
	{
		let importedFile = imports[n];

		if(importedFile.compileIndex === context.compileIndex) { continue; }
		importedFile.compileIndex = context.compileIndex;

		gatherImports(importedFile, buffer);

		buffer.push(importedFile);
	}
}

// TODO: Handle AST.New differently.
function compileSourceExports()
{
	const sourceExports = context.currSourceFile.exports;
	if(sourceExports.length === 0) { return ""; }

	let result = `modules[${context.currSourceFile.id}] = `;

	if(context.currSourceFile.exportDefault)
	{
		const node = sourceExports[0];
		if(node instanceof AST.New) {
			result += doCompileLookup(node) + ";";
		}
		else {
			result += getNameFromNode(sourceExports[0]) + ";";
		}
	}
	else
	{
		result += "{ ";

		let node = sourceExports[0];
		result += getNameFromNode(node);

		for(let n = 1; n < sourceExports.length; n++)
		{
			let node = sourceExports[n];
			result += ", " + getNameFromNode(node);
		}

		let relativePath = path.relative(process.cwd(), context.currSourceFile.fullPath).replace(/\\/g,"/");
		if(relativePath[0] !== ".") {
			relativePath = "./" + relativePath;
		}
		relativePath = relativePath.toLowerCase();

		result += " };";
	}

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
	else if(node instanceof AST.Specifier) {
		const result = compile_Specifier(node);
		return result;
	}
	else if(node instanceof AST.Identifier) {
		return node.value;
	}
	else if(node instanceof AST.Name) {
		return compile_Name(node);
	}
	else if(node instanceof AST.Call) {
		return doCompileLookup(node.value);
	}

	return null;
}

function compile_Identifier(node) {
	return node ? node.value : null
}

function compile_Number(node) {
	return node ? node.value : null
}

function compile_Bool(node) {
	return node.value ? "true" : "false";
}

function compile_String(node) {
	return node.raw;
}

function compile_New(node)
{
	let callee = doCompileLookup(node.callee);
	if(node.callee.type === "Conditional") {
		callee = "(" + callee + ")";
	}

	const result = "new " + callee +
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
		   parentNode.type !== "ThisExpression" &&
		   parentNode.type !== "Name" &&
		   parentNode.type !== "Super")
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
	const decls = node.decls;

	let result = node.kind + " " + compile_VariableNode(decls[0]);

	for(let n = 1; n < decls.length; n++) {
		result += ", " + compile_VariableNode(decls[n]);
	}

	return result;
}

function compile_VariableNode(node)
{
	const declName = doCompileLookup(node.value);

	if(node.expr) {
		let result = declName + " = " + doCompileLookup(node.expr);
		return result;
	}

	return declName;
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
	if(props.length === 0) { return "{}"; }

	let propsNode = props[0];
	let result = "{\n";

	incTabs();

	result += tabs + compile_ObjectMember(propsNode)

	for(let n = 1; n < props.length; n++) {
		propsNode = props[n];
		result += ",\n" + tabs + compile_ObjectMember(propsNode)
	}

	decTabs();

	result += `\n${tabs}}`;
	return result;
}

function compile_ObjectMember(node)
{
	let key = doCompileLookup(node.key);

	if(node.computed) {
		key = `[${key}]`;
	}

	if(node.kind && node.kind !== "init")
	{
		let value;
		if(node.value instanceof AST.Function) {
			value = compile_Function(node.value, true);
		}
		else {
			value = doCompileLookup(node.value);
		}

		result = node.kind + " " + key + value;
	}
	else
	{
		const value = doCompileLookup(node.value);
		result = key + ": " + value;
	}

	return result;
}

function compile_Binary(node)
{
	let result;

	if(node.left.type === "Binary") {
		result = "(" + doCompileLookup(node.left) + ")";
	}
	else {
		result = doCompileLookup(node.left);
	}

	result += " " + node.op + " ";

	if(node.right.type === "Binary") {
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
	if(context.flags.transpiling) {
		return compile_Call_ecma5(node);
	}

	return compile_Call_ecma6(node);
}

function compile_Call_ecma5(node)
{
	const value = doCompileLookup(node.value);
	const args = compile_Args(node.args);

	let result;

	if(node.value.type === "Super" ||
	   (node.value.type == "Name" && node.value.parent.type === "Super"))
	{
		result = value + ".call(this";
		if(args) {
			result += ", " + args;
		}
		result += ")";
	}
	else if(node.value instanceof AST.Function) {
		result = `(${value}) (${args})`;
	}
	else {
		result = value + "(" + args + ")";
	}

	return result;
}

function compile_Call_ecma6(node)
{
	let result = doCompileLookup(node.value);
	result += "(" + compile_Args(node.args) + ")";
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

function compile_Function(node, withoutFunc, funcName)
{
	if(!funcName)
	{
		funcName = doCompileLookup(node.id);
		if(funcName) {
			funcName = " " + funcName;
		}
	}
	else {
		funcName = " " + funcName;
	}

	let result = "";
	if(!withoutFunc) {
		result = "function";
	}

	result += funcName + "(" + compile_Args(node.params) + ") " +
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
	let content = doCompileLookup(node.arg);
	let result = "return";
	if(content) {
		result += " " + content;
	}

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
			result += "\n" + tabs + "else " + compile_If(node.alternate);
		}
		else
		{
			result += "\n" + tabs + "else ";

			if(node.alternate.type !== "Block")
			{
				incTabs();
				result += doCompileLookup(node.alternate) + ";\n";
				decTabs();
			}
			else {
				result += doCompileLookup(node.alternate);
			}

			result += tabs;
		}
	}

	return result;
}

function compile_Conditional(node)
{
	let result = doCompileLookup(node.test) + " ? " +
		doCompileLookup(node.consequent) + " : " +
		doCompileLookup(node.alternate);

	return result;
}

function compile_Unary(node)
{
	let arg = doCompileLookup(node.arg);
	if(node.arg.type === "Binary" || node.op === "void") {
		arg = "(" + arg + ")";
	}

	let op = node.op;
	if(op === "typeof" || op === "delete") {
		op += " ";
	}

	let result;

	if(node.prefix) {
		result = op + arg;
	}
	else {
		result = arg + op;
	}

	return result;
}

function compile_Switch(node)
{
	let result = "switch(" + doCompileLookup(node.discriminant) + ") {\n";

	incTabs();

	result += compile_SwitchCases(node.cases);

	decTabs();

	result += tabs + "}";

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

	let prevNode = null;
	const buffer = node.scope.body;
	for(let n = 0; n < buffer.length; n++)
	{
		let bufferNode = buffer[n];
		if(bufferNode instanceof AST.Block) {
			decTabs();
			result += tabs + compile_Block(bufferNode);
			incTabs();
		}
		else
		{
			if(prevNode && prevNode instanceof AST.Block) {
				result += " " + doCompileLookup(bufferNode) + ";\n";
			}
			else {
				result += tabs + doCompileLookup(bufferNode) + ";\n";
			}
		}

		prevNode = bufferNode;
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
	if(node.body instanceof AST.EmptyStatement) {
		return "";
	}

	let result = "while(" +
		doCompileLookup(node.test) + ") " +
		doCompileLookup(node.body);

	return result;
}

function compile_DoWhile(node)
{
	let result = "do " +
		doCompileLookup(node.body) +
		" while(" + doCompileLookup(node.test) + ")";

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

	for(let n = 1; n < exprs.length; n++) {
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

function compile_Throw(node)
{
	const result = "throw " + doCompileLookup(node.arg);

	return result;
}

function compile_Import(node)
{
	const specifiers = node.specifiers;

	let value = node.source.value;
	if(value[0] === ".")
	{
		if(!path.extname(value)) {
			value += ".js";
		}
	}
	value = value.toLowerCase();

	let result;

	if(context.flags.transpiling)
	{
		const numSpecifiers = specifiers.length
		if(numSpecifiers === 0) { return }

		const moduleExportsFile = `modules[${node.sourceFile.id}]`

		if(numSpecifiers === 1)
		{
			const specifier = specifiers[0]
			const localAs = compile_Identifier(specifier.localAs)
			const local = specifiers.local ? compile_Identifier(specifier.local) : localAs
			
			if(specifier.isDefault) {
				result = `var ${local} = ${moduleExportsFile}`
			}
			else {
				result = `var ${local} = ${moduleExportsFile}.${localAs}`
			}
		}
		else
		{
			const filename = `__module${node.sourceFile.id}`
			result = `var ${filename} = ${moduleExportsFile}`

			for(let n = 0; n < numSpecifiers; n++)
			{
				const specifier = specifiers[n]
				const local = compile_Identifier(specifier.local)
				
				if(specifier.isDefault) {
					result += `;\n${tabs}var ${local} = ${filename}`
				}
				else {
					const localAs = specifier.localAs ? compile_Identifier(specifier.localAs) : local
					result += `;\n${tabs}var ${localAs} = ${filename}.${local}`
				}
			}
		}
	}
	else
	{
		result += "import " +
			compile_Specifiers(specifiers) +
			" from " +
			doCompileLookup(node.source);
	}

	return result;
}

function compile_Specifiers(specifiers)
{
	let node = specifiers[0];

	if(!node.localAs) {
		return doCompileLookup(node.local);
	}

	let result = "{ " + compile_Specifier(node)

	for(let n = 1; n < specifiers.length; n++) {
		node = specifiers[n];
		result += ", " + compile_Specifier(node)
	}

	result += " }";

	return result;
}

function compile_Specifier(node) {
	return node.localAs ? doCompileLookup(node.localAs) : doCompileLookup(node.local)
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
	if(context.flags.transpiling) {
		return compile_Class_ecma5(node);
	}

	return compile_Class_ecma6(node);
}

function compile_Class_ecma5(node)
{
	clsCtx.inside = true;
	clsCtx.id = doCompileLookup(node.id);
	clsCtx.superCls = doCompileLookup(node.superCls);

	let result = compile_ClassBody_ecma5(node.body);

	if(clsCtx.superCls) {
		requirements.inherits = true;
		result += "\n" + tabs + "_inherits(" + clsCtx.id + ", " + clsCtx.superCls + ");\n";
	}

	clsCtx.inside = false;

	return result;
}

function compile_Class_ecma6(node)
{
	let result = "class " + clsCtx.id;

	if(clsCtx.superCls) {
		result += " extends " + doCompileLookup(clsCtx.superCls);
	}

	result += " {\n";

	incTabs();
	result += compile_ClassBody_ecma6(node.body);
	decTabs();

	result += tabs + "}";

	return result;
}

function compile_ClassBody_ecma6(node)
{
	let result = "";

	const buffer = node.buffer;
	for(let n = 0; n < buffer.length; n++) {
		let bufferNode = buffer[n];
		result += tabs + compile_MethodDef(bufferNode, true) + "\n";
	}

	return result;
}

function compile_ClassBody_ecma5(node)
{
	let constrResult;
	let proto = "";

	incTabs();

	const buffer = node.buffer;
	for(let n = 0; n < buffer.length; n++)
	{
		const bufferNode = buffer[n];

		if(bufferNode.kind === "constructor") {
			decTabs();
			clsCtx.insideConstr = true;
			constrResult = compile_Function(bufferNode.value, false, clsCtx.id) + "\n";
			clsCtx.insideConstr = false;
			incTabs();
		}
		else
		{
			const protoDecl = proto ? ",\n" : "";
			proto += protoDecl + tabs + compile_MethodDef_ecma5(bufferNode);
		}
	}

	decTabs();

	if(!constrResult) {
		constrResult = "function " + clsCtx.id + "() {};\n";
	}

	if(proto) {
		proto = tabs + clsCtx.id + ".prototype = {\n" + proto + "\n" + tabs + "};\n";
	}

	const result = constrResult + proto;

	return result;
}

function compile_MethodDef_ecma6(node)
{
	const key = doCompileLookup(node.key);

	let result = "";
	if(node.kind === "get" || node.kind === "set") {
		result = node.kind + " ";
	}
	result += key + compile_Function(node.value, true);

	return result;
}

function compile_MethodDef_ecma5(node)
{
	const key = doCompileLookup(node.key);

	let result = "";
	if(node.kind === "get" || node.kind === "set") {
		result = node.kind + " " + key + compile_Function(node.value, true);
	}
	else {
		result = key + ": " + compile_Function(node.value, false);
	}

	return result;
}

function compile_ThisExpression(node) {
	return "this";
}

function compile_LogicalExpression(node)
{
	let left = doCompileLookup(node.left);
	let right = doCompileLookup(node.right);

	let result;

	if(node.left instanceof AST.Binary)
	{
		if(node.right instanceof AST.Binary) {
			result = `(${left}) ${node.op} (${right})`;
		}
		else {
			result = `(${left}) ${node.op} ${right}`;
		}
	}
	else if(node.right instanceof AST.Binary) {
		result = `${left} ${node.op} (${right})`;
	}
	else {
		result = `${left} ${node.op} ${right}`;
	}

	return result;
}

function compile_ArrowFunctionExpression(node)
{
	const result = "(" + compile_Args(node.params) + ") => " + doCompileLookup(node.body);
	return result;
}

function compile_Super(node)
{
	if(context.flags.transpiling) {
		return compile_Super_ecma5(node);
	}

	const result = "super";
	return result;
}

function compile_Super_ecma5(node)
{
	let result;

	if(clsCtx.insideConstr) {
		result = clsCtx.superCls;
	}
	else {
		result = clsCtx.superCls + ".prototype";
	}

	return result;
}

function compile_TemplateLiteral(node)
{
	let result = "\"";

	const expressions = node.expressions;
	const quasis = node.quasis;
	const num = quasis.length - 1;

	if(num === 0) {
		result += compile_Quasis(quasis[0]);
	}
	else
	{
		for(let n = 0; n < quasis.length - 1; n++) {
			result += compile_Quasis(quasis[n]) + "\" + " + doCompileLookup(expressions[n]) + " + \"";
		}

		result += quasis[num].value;
	}

	result += "\"";

	return result;
}

function compile_Quasis(node)
{
	let result = node.value.replace(/\n/g, "\\n")
						   .replace(/\t/g, "\\t")
						   .replace(/\"/g, "\\\"");
	return result;
}

function compile_EmptyStatement(node) {
	return "";
}
function compile_ExportSpecifier(node)
{
	let result;

	if(node.local.value === node.exported.value) {
		result = node.local.value;
	}
	else {
		result = node.exported.value + ": " + node.local.value;
	}

	return result;
}

// TODO: Temporary solution
function compile_ExportDefaultDeclaration(node)
{
	const decl = node.decl;

	let result = `modules[${context.currSourceFile.id}] = `;

	if(decl instanceof AST.Binary) {
		 result += doCompileLookup(decl.right);
	}
	else if(decl instanceof AST.Class) {
		result = doCompileLookup(decl) + tabs + result + doCompileLookup(decl.id);
	}
	else {
		result += doCompileLookup(decl);
	}

	return result;
}

const compile_ExportAllDeclaration = (node) => {
	
}

const compile_ObjectPattern = (node) =>
{
	let result = "{ "

	const properties = node.properties
	if(properties.length > 0)
	{
		const prop = properties[0]
		result += doCompileLookup(prop.key)

		for(let n = 1; n < properties.length; n++) {
			const prop = properties[n]
			result += ", " + doCompileLookup(prop.key)
		}
	}

	result += " }"
	return result
}

const compile_AssignmentPattern = (node) => {
	const result = doCompileLookup(node.left)
	return result
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
	return node ? compileLookup[node.constructor.name](node) : "";
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
	Array: compile_Array,
	Object: compile_Object,
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
	Throw: compile_Throw,
	Import: compile_Import,
	Export: compile_Export,
	Class: compile_Class,
	ThisExpression: compile_ThisExpression,
	LogicalExpression: compile_LogicalExpression,
	ArrowFunctionExpression: compile_ArrowFunctionExpression,
	Super: compile_Super,
	TemplateLiteral: compile_TemplateLiteral,
	EmptyStatement: compile_EmptyStatement,
	ExportDefaultDeclaration: compile_ExportDefaultDeclaration,
	ExportAllDeclaration: compile_ExportAllDeclaration,
	ObjectPattern: compile_ObjectPattern,
	AssignmentPattern: compile_AssignmentPattern
}

module.exports = {
	compile
}
