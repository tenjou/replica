const acorn = require("../lib/acorn.js");
const AST = require("./ast.js");

const acornCfg = {
	ecmaVersion: 6,
	sourceType: "module"
};

const context = {
	sourceFiles: {},
	currSourceId: 0,
	currSourceFile: null,
	fetchFunc: null,
	doneFunc: null
};

function parse(rootPath, path, fetchFunc, doneFunc) 
{
	context.fetchFunc = fetchFunc;
	context.doneFunc = doneFunc;

	getSourceFile(rootPath, path);
}

function getSourceFile(rootPath, path)
{
	const ext = path.split(".").pop();
	if(ext !== "js") {
		path += ".js";
	}

	const fullPath = rootPath + path;
	console.log("fullpath:", fullPath)

	let sourceFile = context.sourceFiles[fullPath];
	if(!sourceFile) 
	{
		const sourceFileId = "_" + (context.currSourceId++);
		sourceFile = new SourceFile(sourceFileId, rootPath);
		context.sourceFiles[fullPath] = sourceFile;

		context.fetchFunc(rootPath, path, content => {
			sourceFile.content = content;
			context.doneFunc(sourceFile);
		});
	}

	return sourceFile;
}

class SourceFile
{
	constructor(id, rootPath) 
	{
		console.log("FILE:", id, rootPath);

		this.id = id;
		this.rootPath = rootPath;
		this.compileIndex = 0;
		this.blockNode = null;
		this.imports = [];
		this.exports = [];
	}

	set content(content)
	{
		const node = acorn.parse(content, acornCfg);

		context.currSourceFile = this;
		this.imports.length = 0;
		this.exports.length = 0;
		this.blockNode = parse_BlockStatement(node);
	}
}

function Scope() {
	this.body = [];
}

function parse_Identifier(node) {
	return new AST.Identifier(node.name);
}

function parse_Literal(node) 
{
	if(typeof node.value === "string") {
		return new AST.String(node.value);
	}
	else 
	{
		if(node.raw === "false") {
			return new AST.Bool(0);
		}
		else if(node.raw === "true") {
			return new AST.Bool(1);
		}
		else if(node.raw === "null") {
			return new AST.Null;
		}
	}

	return new AST.Number(node.value);
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

function parse_ObjectExpression(node)
{
	const props = node.properties;
	const propsBuffer = new Array(props.length);
	for(let n = 0; n < props.length; n++) {
		let propNode = props[n];
		propsBuffer[n] = parse_ObjectMember(propNode);
	}

	const objExpr = new AST.Object(propsBuffer);
	return objExpr;
}

function parse_ObjectMember(node)
{
	const key = doLookup(node.key);
	const value = doLookup(node.value);

	const objMemberExpr = new AST.ObjectMember(key, value);
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

function parse_ThisExpression(node)
{
	const thisExpr = new AST.This();
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
	const body = parse_BlockStatement(node.body);

	const forExpr = new AST.For(init, test, update, body);
	return forExpr;
}

function parse_ForInStatement(node)
{
	const left = doLookup(node.left);
	const right = doLookup(node.right);
	const body = parse_BlockStatement(node.body);

	const forInExpr = new AST.ForIn(left, right, body);
	return forInExpr;
}

function parse_WhileStatement(node)
{
	const test = doLookup(node.test);
	const body = parse_BlockStatement(node.body);

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

function parse_CatchClause(node)
{
	const param = doLookup(node.param);
	const body = parse_BlockStatement(node.body);

	const catchClause = new AST.Catch(param, body);
	return catchClause;
}

function parse_ImportDeclaration(node)
{
	const specifiersMap = {};

	const source = doLookup(node.source);
	const imported = parse_ImportSpecifiers(node.specifiers, specifiersMap);

	const sourceFile = getSourceFile(context.currSourceFile.rootPath, source.value);
	const importDecl = new AST.Import(source, specifiersMap, imported, sourceFile);
	context.currSourceFile.imports.push(sourceFile);

	return importDecl;
}

function parse_ImportSpecifiers(specifiers, map)
{
	let isImported = false;

	for(let n = 0; n < specifiers.length; n++)
	{
		let node = specifiers[n];
		let imported = doLookup(node.imported);
		let local = doLookup(node.local);

		if(!imported) {
			map[local.value] = null;
			isImported = true;
		}
		else {
			map[local.value] = imported.value;
		}
	}

	return isImported;
}

function parse_ExportNamedDeclaration(node)
{
	const decl = doLookup(node.declaration);

	context.currSourceFile.exports.push(decl);

	return decl;
}

function doLookup(node) {
	return node ? lookup[node.type](node) : null;
}

const lookup = {
	Identifier: parse_Identifier,
	Literal: parse_Literal,
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
	ImportDeclaration: parse_ImportDeclaration,
	ExportNamedDeclaration: parse_ExportNamedDeclaration
};

module.exports = {
	SourceFile, parse
};
