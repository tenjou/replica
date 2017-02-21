const fs = require("fs");
const path = require("path");
const acorn = require("./acorn.js");
const AST = require("./ast.js");
const compiler = require("./compiler.js");
const logger = require("../logger");

const ctx = {
	sourceFiles: {},
	currSourceId: 0,
	currSourceFile: null
};

const nodeModulesPath = process.cwd() + "/node_modules/";

const acornCfg = {
	ecmaVersion: 6,
	sourceType: "module"
};

const customModules = {};
const modules = {};

class SourceFile
{
	constructor(id, filePath)
	{
		const slash = path.normalize("/");

		this.id = id;
		this.rootPath = path.dirname(filePath) + slash;
		this.filename = path.basename(filePath);
		this.extname = path.extname(this.filename);

		this.compileIndex = 0;
		this.timestamp = Date.now();
		this.blockNode = null;
		this.imports = [];
		this.importsMap = {};
		this.exports = [];
		this.exportDefault = false;
		this.updating = false;
	}

	clear()
	{
		this.updating = false;
		this.exportDefault = false;
		this.importsMap = {};
		this.imports.length = 0;
		this.exports.length = 0;
		this.timestamp = Date.now();
	}

	update()
	{
		let filePath = this.rootPath + this.filename;

		if(!fs.existsSync(filePath))
		{
			if(fs.existsSync(filePath + ".js")) {
				filePath += ".js"
				this.filename += ".js"
				this.extname = ".js"
			}
			else {
				this.blockNode = null;
				console.error("(SourceFile.update) No such file exists:", filePath);
				return;
			}
		}

		this.updating = true;

		const content = fs.readFileSync(filePath, "utf8");

		switch(this.extname)
		{
			case ".js":
			{
				let node = null;
				try {
					node = acorn.parse(content, acornCfg);
				}
				catch(error) {
					console.error(`ParseError: <${this.filename}>`, error);
				}

				const prevSourceFile = ctx.currSourceFile;
				ctx.currSourceFile = this;

				this.clear();
				this.blockNode = parse_BlockStatement(node);

				ctx.currSourceFile = prevSourceFile;
			} break;

			case ".json":
				this.blockNode = parse_JSON(content);
				break;

			default:
				this.blockNode = parse_Text(content);
				break;
		}

		this.updating = false;
	}

	get fullPath() {
		return this.rootPath + this.filename;
	}
}


function addLibrary(name, filePath) {
	customModules[name] = filePath;
}

function getSourceFile(filePath)
{
	let sourceFile = ctx.sourceFiles[filePath.toLowerCase()];
	if(!sourceFile)
	{
		sourceFile = new SourceFile(ctx.currSourceId++, filePath);
		ctx.sourceFiles[filePath.toLowerCase()] = sourceFile;
		sourceFile.update();
	}

	return sourceFile;
}

function parse(filePath)
{
	const sourceFile = getSourceFile(filePath);
	return sourceFile;
}

function parseAll(filePath)
{
	const sourceFile = this.parse(filePath);
	return sourceFile;
}

function compile(sourceFile, needModule)
{
	const result = compiler.compile(sourceFile, {
		type: "content",
		transpiling: true,
		needModule: needModule,
		modules
	});
	return result;
}

function compileAll(sourceFile)
{
	const result = compiler.compile(sourceFile, {
		type: "content",
		concat: true,
		transpiling: true,
		needModule: true,
		modules
	});

	return result;
}

function getImports(sourceFile)
{
	if(!sourceFile) {
		console.error("(getImports) Invalid sourceFile passed");
		return null;
	}

	const imports = compiler.compile(sourceFile, {
		type: "imports",
		transpiling: true,
		modules
	});

	return imports;
}

function Scope() {
	this.body = [];
}

function parse_Text(text)
{
	text = "\"" + text.replace(/\r\n|\r|\n/g, "\\\n") + "\"";

	const textNode = new AST.String(null, text);
	const exportDefaultDecl = new AST.ExportDefaultDeclaration(textNode);

	const scope = new Scope();
	scope.body.push(exportDefaultDecl);

	const block = new AST.Block(scope);
	return block;
}

function parse_JSON(text)
{
	text = "\"" + text.replace(/\n|\r|\t/g, "").replace(/\"/g, "\\\"") + "\"";

	const textNode = new AST.String(null, text);

	const parentNameNode = new AST.Identifier("JSON");
	const funcNameNode = new AST.Identifier("parse");
	const nameNode = new AST.Name(funcNameNode, parentNameNode);

	const callNode = new AST.Call(nameNode, [ textNode ]);

	const exportDefaultDecl = new AST.ExportDefaultDeclaration(callNode);

	const scope = new Scope();
	scope.body.push(exportDefaultDecl);

	const block = new AST.Block(scope);
	return block;
}

function parse_Identifier(node) {
	return new AST.Identifier(node.name);
}

function dontParse(node) {
	return node;
}

function parse_ExpressionStatement(node) {
	return doLookup(node.expression);
}

function parse_CallExpression(node)
{
	const nameExpr = doLookup(node.callee);
	const args = parse_Args(node.arguments);

	const callExpr = new AST.Call(nameExpr, args);
	return callExpr;
}

function parse_MemberExpression(node)
{
	const propExpr = doLookup(node.property);
	const parentExpr = doLookup(node.object);

	const nameExpr = new AST.Name(propExpr, parentExpr, node.computed);
	return nameExpr;
}

function parse_BinaryExpression(node)
{
	const left = doLookup(node.left);
	const right = doLookup(node.right);

	const binaryExpr = new AST.Binary(left, right, node.operator);
	return binaryExpr;
}

function parse_UpdateExpression(node)
{
	const arg = doLookup(node.argument);

	const updateExpr = new AST.Update(arg, node.operator, node.prefix);
	return updateExpr;
}

function parse_AssignmentExpression(node)
{
	const left = doLookup(node.left);
	const right = doLookup(node.right);

	const binaryExpr = new AST.Binary(left, right, node.operator);
	return binaryExpr;
}

function parse_ArrayExpression(node)
{
	const elements = node.elements;
	const elementsBuffer = new Array(elements.length);
	for(let n = 0; n < elements.length; n++) {
		let elementNode = elements[n];
		elementsBuffer[n] = doLookup(elementNode);
	}

	const arrayExpr = new AST.Array(elementsBuffer);
	return arrayExpr;
}

const parse_ObjectExpression = (node) =>
{
	const props = node.properties
	const propsBuffer = new Array(props.length)
	for(let n = 0; n < props.length; n++) {
		let prop = props[n]
		propsBuffer[n] = parse_Property(prop)
	}

	const objExpr = new AST.Object(propsBuffer)
	return objExpr;
}

function parse_ObjectMember(node)
{
	const key = doLookup(node.key);
	const value = doLookup(node.value);

	const objMemberExpr = new AST.ObjectMember(key, value, node.kind, node.computed);
	return objMemberExpr;
}

function parse_NewExpression(node)
{
	const callee = doLookup(node.callee);
	const args = parse_Args(node.arguments);

	const newExpr = new AST.New(callee, args);
	return newExpr;
}

function parse_NullExpression(node) {
	return new AST.Null();
}

function parse_ConditionalExpression(node)
{
	const test = doLookup(node.test);
	const consequent = doLookup(node.consequent);
	const alternate = doLookup(node.alternate);

	const conditionalExpr = new AST.Conditional(test, consequent, alternate);
	return conditionalExpr;
}

function parse_UnaryExpression(node)
{
	const arg = doLookup(node.argument);

	const unaryExpr = new AST.Unary(arg, node.operator, node.prefix);
	return unaryExpr;
}

function parse_SequenceExpression(node)
{
	const exprs = parse_Sequences(node.expressions);

	const sequenceExpr = new AST.Sequence(exprs);
	return sequenceExpr;
}

function parse_Sequences(exprs)
{
	const buffer = new Array(exprs.length);
	for(let n = 0; n < exprs.length; n++) {
		let node = exprs[n];
		let sequenceNode = doLookup(node);
		buffer[n] = sequenceNode;
	}

	return buffer;
}

function parse_FunctionExpression(node)
{
	const body = parse_BlockStatement(node.body);
	const id = doLookup(node.id);
	const params = parse_Args(node.params);

	const funcExpr = new AST.Function(id, params, body);
	return funcExpr;
}

function parse_LogicalExpression(node)
{
	const left = doLookup(node.left);
	const right = doLookup(node.right);

	const logicalExpr = new AST.LogicalExpression(left, right, node.operator);
	return logicalExpr;
}

function parse_ArrowFunctionExpression(node)
{
	const body = doLookup(node.body);
	const params = parse_Args(node.params);

	const arrowFuncExpr = new AST.ArrowFunctionExpression(params, node.expression, node.generator, body);
	return arrowFuncExpr;
}

function parse_ThisExpression(node)
{
	const thisExpr = new AST.ThisExpression();
	return thisExpr;
}

function parse_VariableDeclaration(node)
{
	const decls = node.declarations;
	const vars = new Array(decls.length);

	for(let n = 0; n < decls.length; n++) {
		vars[n] = parse_VariableDeclarator(decls[n]);
	}

	const varDecl = new AST.VariableDeclaration(vars, node.kind);
	return varDecl;
}

function parse_VariableDeclarator(node)
{
	const id = doLookup(node.id);
	const init = doLookup(node.init);

	const varDecl = new AST.Variable(id, init);
	return varDecl;
}

function parse_Args(nodes)
{
	const num = nodes.length;
	const args = new Array(num);

	for(let n = 0; n < num; n++) {
		let node = nodes[n];
		let arg = doLookup(node);
		args[n] = arg;
	}

	return args;
}

function parse_FunctionDeclaration(node)
{
	const id = doLookup(node.id);
	const params = parse_Args(node.params);
	const body = doLookup(node.body);

	const funcDecl = new AST.Function(id, params, body);
	return funcDecl;
}

function parse_ClassDeclaration(node)
{
	const id = doLookup(node.id);
	const superCls = doLookup(node.superClass);
	const body = parse_ClassBody(node.body);

	const clsDecl = new AST.Class(id, superCls, body);
	return clsDecl;
}

function parse_ClassBody(node)
{
	const body = node.body;
	const buffer = new Array(body.length);

	for(let n = 0; n < buffer.length; n++) {
		let bodyNode = body[n];
		let parsedBodyNode = doLookup(bodyNode);
		buffer[n] = parsedBodyNode;
	}

	const clsBody = new AST.ClassBody(buffer);
	return clsBody;
}

function parse_MethodDefinition(node)
{
	const key = doLookup(node.key);
	const value = doLookup(node.value);

	const methodDef = new AST.MethodDef(key, value, node.kind, node.static);
	return methodDef;
}

function parse_BlockStatement(node)
{
	if(!node) { return null; }

	const scope = new Scope();

	parse_Body(node.body, scope);

	const blockExpr = new AST.Block(scope);
	return blockExpr;
}

function parse_Body(body, scope)
{
	const buffer = scope.body;

	for(let n = 0; n < body.length; n++) {
		let node = body[n];
		let expr = doLookup(node);
		buffer.push(expr);
	}
}

function parse_ReturnStatement(node)
{
	const arg = doLookup(node.argument);

	const returnExpr = new AST.Return(arg);
	return returnExpr;
}

function parse_IfStatement(node)
{
	const test = doLookup(node.test);
	const consequent = doLookup(node.consequent);
	const alternate = node.alternate ? doLookup(node.alternate) : null;

	const ifExpr = new AST.If(test, consequent, alternate);
	return ifExpr;
}

function parse_SwitchStatement(node)
{
	const cases = parse_SwitchCases(node.cases);
	const discriminant = doLookup(node.discriminant);

	const switchExpr = new AST.Switch(cases, discriminant);
	return switchExpr;
}

function parse_SwitchCases(cases)
{
	const buffer = new Array(cases.length);
	for(let n = 0; n < buffer.length; n++) {
		let node = cases[n];
		let switchCaseNode = parse_SwitchCase(node);
		buffer[n] = switchCaseNode;
	}

	return buffer;
}

function parse_SwitchCase(node)
{
	const scope = parse_Consequent(node.consequent);
	const test = doLookup(node.test);

	const switchCaseExpr = new AST.SwitchCase(test, scope);
	return switchCaseExpr;
}

function parse_Consequent(consequent)
{
	const scope = new Scope();
	const buffer = parse_Body(consequent, scope);
	return scope;
}

function parse_BreakStatement(node)
{
	const breakExpr = new AST.Break();
	return breakExpr;
}

function parse_ForStatement(node)
{
	const init = doLookup(node.init);
	const test = doLookup(node.test);
	const update = doLookup(node.update);
	const body = doLookup(node.body);

	const forExpr = new AST.For(init, test, update, body);
	return forExpr;
}

function parse_ForInStatement(node)
{
	const left = doLookup(node.left);
	const right = doLookup(node.right);
	const body = doLookup(node.body);

	const forInExpr = new AST.ForIn(left, right, body);
	return forInExpr;
}

function parse_WhileStatement(node)
{
	const test = doLookup(node.test);
	const body = doLookup(node.body);

	const whileStatement = new AST.While(test, body);
	return whileStatement;
}

function parse_DoWhileStatement(node)
{
	const test = doLookup(node.test);
	const body = parse_BlockStatement(node.body);

	const doWhileStatement = new AST.DoWhile(test, body);
	return doWhileStatement;
}

function parse_ContinueStatement(node)
{
	const continueStatement = new AST.Continue();
	return continueStatement;
}

function parse_LabeledStatement(node)
{
	const label = doLookup(node.label);
	const body = parse_BlockStatement(node.body);

	const labeledStatement = new AST.Label(label, body);
	return labeledStatement;
}

function parse_TryStatement(node)
{
	const block = parse_BlockStatement(node.block);
	const handler = parse_CatchClause(node.handler);

	const tryStatement = new AST.Try(block, handler);
	return tryStatement;
}

function parse_ThrowStatement(node)
{
	const arg = doLookup(node.argument);

	const throwStatement = new AST.Throw(arg);
	return throwStatement;
}

function parse_CatchClause(node)
{
	const param = doLookup(node.param);
	const body = parse_BlockStatement(node.body);

	const catchClause = new AST.Catch(param, body);
	return catchClause;
}

function parse_ImportDeclaration(node, exported)
{
	const source = doLookup(node.source);
	
	let specifiers
	if(node.specifiers) {
		specifiers = exported ? parse_ExportSpecifiers(node.specifiers) : parse_ImportSpecifiers(node.specifiers);
	}
	else {
		specifiers = null
	}

	const moduleName = source.value;

	let fullPath;
	if(moduleName[0] !== ".")
	{
		let modulePath;
		let custom;

		const customModulePath = customModules[moduleName];
		if(customModulePath) {
			modulePath = customModulePath;
			custom = true;
		}
		else {
			modulePath = nodeModulesPath + moduleName;
			custom = false;
		}

		if(!fs.existsSync(modulePath)) {
			logger.logError("ModuleNotFound", moduleName);
			return;
		}

		if(fs.lstatSync(modulePath).isDirectory())
		{
			const packagePath = modulePath + "/package.json";
			if(!fs.existsSync(packagePath)) {
				logger.logError("PackageNotFound", moduleName);
				return;
			}

			const packageContent = JSON.parse(fs.readFileSync(packagePath, "utf8"));
			const mainEntry = packageContent.main;
			if(!mainEntry) {
				logger.logError("PackageEntryNotFound", moduleName);
				return;
			}

			fullPath = path.resolve(modulePath, mainEntry);
		}
		else {
			fullPath = customLibraryPath;
		}

		modules[moduleName] = {
			path: fullPath,
			custom
		}
	}
	else
	{
		fullPath = path.resolve(ctx.currSourceFile.rootPath, moduleName);
		if(path.extname(fullPath) === "") {
			fullPath += ".js";
		}
	}

	const sourceFile = getSourceFile(fullPath);
	if(sourceFile.updating) {
		throw `Circular import detected in:\n    "${ctx.currSourceFile.rootPath + ctx.currSourceFile.filename}"\n because of importing:\n    "${fullPath}"`;
	}

	const importDecl = new AST.Import(source, specifiers, sourceFile);
	ctx.currSourceFile.imports.push(sourceFile);

	return importDecl;
}

function parse_ImportSpecifiers(specifiers)
{
	const importsMap = ctx.currSourceFile.importsMap;

	const num = specifiers.length
	const buffer = new Array(num)
	for(let n = 0; n < num; n++) {
		const specifier = parse_ImportSpecifier(specifiers[n])
		const key = specifier.localAs ? specifier.localAs.value : specifier.local.value
		importsMap[key] = true
		buffer[n] = specifier
	}

	return buffer
}

function parse_ImportSpecifier(node)
{
	const local = doLookup(node.local)
	const imported = doLookup(node.imported)
	const importSpecifier = new AST.Specifier(imported, local, (node.type === "ImportDefaultSpecifier"))
	return importSpecifier
}

function parse_ExportNamedDeclaration(node)
{
	const specifiers = node.specifiers;

	let source = null;
	if(node.source) {
		source = parse_ImportDeclaration(node, true);
	}

	if(specifiers.length > 0)
	{
		for(let n = 0; n < specifiers.length; n++) {
			const exportSpecifier = parse_ExportSpecifier(specifiers[n]);
			ctx.currSourceFile.exports.push(exportSpecifier);
		}

		return source;
	}

	const decl = doLookup(node.declaration);

	ctx.currSourceFile.exports.push(decl);

	return decl;
}

function parse_ExportSpecifiers(specifiers)
{
	const importsMap = ctx.currSourceFile.importsMap;

	const num = specifiers.length
	const buffer = new Array(num)
	for(let n = 0; n < num; n++) {
		const specifier = parse_ExportSpecifier(specifiers[n])
		importsMap[specifier.localAs.value] = true
		buffer[n] = specifier
	}

	return buffer
}

function parse_ExportSpecifier(node)
{
	const local = doLookup(node.local)
	const exported = doLookup(node.exported)
	const exportSpecifier = new AST.Specifier(local, exported, (node.type === "ExportDefaultSpecifier"));
	return exportSpecifier
}

function parse_ExportDefaultDeclaration(node)
{
	const decl = doLookup(node.declaration);

	const exportDefaultDecl = new AST.ExportDefaultDeclaration(decl);
	return exportDefaultDecl;
}

const parse_ExportAllDeclaration = (node) => {
	return parse_ImportDeclaration(node, true)
	// const source = doLookup(node.source)
	// const exportAllDeclaration = new AST.ExportAllDeclaration(source)
	// return exportAllDeclaration
}

function parse_Super(node)
{
	const superNode = new AST.Super();
	return superNode;
}

function parse_TemplateLiteral(node)
{
	const expressions = parse_TemplateExpressions(node.expressions);
	const quasis = parse_TemplateQuasis(node.quasis);

	const templateLiteral = new AST.TemplateLiteral(expressions, quasis);
	return templateLiteral;
}

function parse_TemplateExpressions(expressions)
{
	const num = expressions.length;
	const result = new Array(num);

	for(let n = 0; n < num; n++)
	{
		const expr = doLookup(expressions[n]);
		result[n] = expr;
	}

	return result;
}

function parse_TemplateQuasis(quasis)
{
	const num = quasis.length;
	const result = new Array(num);

	for(let n = 0; n < num; n++)
	{
		const q = parse_TemplateElement(quasis[n]);
		result[n] = q;
	}

	return result;
}

const parse_TemplateElement = (node) => {
	const templateElement = new AST.String(node.value.cooked, node.value.raw);
	return templateElement
}

const parse_EmptyStatement = (node) => {
	const emptyStatement = new AST.EmptyStatement();
	return emptyStatement
}

const parse_ObjectPattern = (node) => {
	const properties = parse_Properties(node.properties)
	const objectPattern = new AST.ObjectPattern(properties)
	return objectPattern
}

const parse_Properties = (buffer) => {
	const result = new Array(buffer.length)
	for(let n = 0; n < buffer.length; n++) {
		const prop = doLookup(buffer[n])
		result[n] = prop
	}
	return result
}

const parse_Property = (node) => {
	const key = doLookup(node.key)
	const value = doLookup(node.value)
	const property = new AST.Property(key, value, node.kind, node.computed)
	return property
}

const parse_AssignmentPattern = (node) => {
	const left = doLookup(node.left)
	const right = doLookup(node.right)
	const assignmentPattern = new AST.AssignmentPattern(left, right)
	return assignmentPattern
}

function doLookup(node) {
	return node ? lookup[node.type](node) : null
}

const lookup = {
	Identifier: parse_Identifier,
	String: dontParse,
	Bool: dontParse,
	Number: dontParse,
	Null: dontParse,
	ExpressionStatement: parse_ExpressionStatement,
	CallExpression: parse_CallExpression,
	MemberExpression: parse_MemberExpression,
	BinaryExpression: parse_BinaryExpression,
	UpdateExpression: parse_UpdateExpression,
	AssignmentExpression: parse_AssignmentExpression,
	ArrayExpression: parse_ArrayExpression,
	ObjectExpression: parse_ObjectExpression,
	NewExpression: parse_NewExpression,
	NullExpression: parse_NullExpression,
	ConditionalExpression: parse_ConditionalExpression,
	UnaryExpression: parse_UnaryExpression,
	SequenceExpression: parse_SequenceExpression,
	FunctionExpression: parse_FunctionExpression,
	LogicalExpression: parse_LogicalExpression,
	ArrowFunctionExpression: parse_ArrowFunctionExpression,
	ThisExpression: parse_ThisExpression,
	VariableDeclaration: parse_VariableDeclaration,
	VariableDeclarator: parse_VariableDeclarator,
	FunctionDeclaration: parse_FunctionDeclaration,
	ClassDeclaration: parse_ClassDeclaration,
	MethodDefinition: parse_MethodDefinition,
	BlockStatement: parse_BlockStatement,
	ReturnStatement: parse_ReturnStatement,
	IfStatement: parse_IfStatement,
	SwitchStatement: parse_SwitchStatement,
	BreakStatement: parse_BreakStatement,
	ForStatement: parse_ForStatement,
	ForInStatement: parse_ForInStatement,
	WhileStatement: parse_WhileStatement,
	DoWhileStatement: parse_DoWhileStatement,
	ContinueStatement: parse_ContinueStatement,
	LabeledStatement: parse_LabeledStatement,
	TryStatement: parse_TryStatement,
	ThrowStatement: parse_ThrowStatement,
	ImportDeclaration: parse_ImportDeclaration,
	ExportNamedDeclaration: parse_ExportNamedDeclaration,
	Super: parse_Super,
	TemplateLiteral: parse_TemplateLiteral,
	EmptyStatement: parse_EmptyStatement,
	ExportDefaultDeclaration: parse_ExportDefaultDeclaration,
	ObjectPattern: parse_ObjectPattern,
	Property: parse_Property,
	AssignmentPattern: parse_AssignmentPattern,
	ExportAllDeclaration: parse_ExportAllDeclaration
};

module.exports = {
	parse, parseAll, compile, compileAll, getImports, SourceFile, addLibrary
};
