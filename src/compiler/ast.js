const { ValueType } = require("./types")

function Scope() {
	this.body = []
	this.vars = {}
	this.funcs = {}
	this.objects = {}
	this.parent = null
	this.labelIndex = 0
	this.tmpIndex = 0
	this.globalStr = null
}

class Program 
{
	constructor() 
	{
		this.type = "Program"
		this.start = 0
		this.end = 0

		this.scope = new Scope()
		this.sourceType = null
	}
}

class Identifier
{
	constructor() 
	{
		this.type = "Identifier"
		this.start = 0
		this.end = 0

		this.ref = this

		this.value = null
		this.valueType = ValueType.Dynamic
	}
}

class Number
{
	constructor() 
	{
		this.type = "Number"
		this.start = 0
		this.end = 0

		this.value = 0
		this.valueType = ValueType.Number
		this.simple = true
	}
}

class Bool
{
	constructor() 
	{
		this.type = "Bool"
		this.start = 0
		this.end = 0

		this.value = 0
		this.valueType = ValueType.Number
		this.simple = true
	}
}

class String
{
	constructor() 
	{
		this.type = "String"
		this.start = 0
		this.end = 0

		this.value = null
		this.raw = null
		this.valueType = ValueType.String
		this.simple = true
	}
}

class Name
{
	constructor(value, parent, computed) {
		this.type = "Name";
		this.value = value;
		this.parent = parent;
		this.computed = computed;
	}
}

class Variable
{
	constructor() 
	{
		this.type = "Variable"
		this.start = 0
		this.end = 0

		this.id = null
		this.valueType = ValueType.Dynamic
		this.expr = null
	}
}

class VariableDeclaration
{
	constructor() 
	{
		this.type = "VariableDeclaration"
		this.start = 0
		this.end = 0

		this.decls = null
		this.kind = null
	}
}

class Array
{
	constructor(value) {
		this.type = "Array";
		this.value = value;
	}
}

class Object
{
	constructor(value) {
		this.type = "Object";
		this.value = value;
	}
}

class ExpressionStatement
{
	constructor()
	{
		this.type = "ExpressionStatement"
		this.start = 0
		this.end = 0

		this.expr = null
	}
}

class CallExpression
{
	constructor() 
	{
		this.type = "CallExpression"
		this.start = 0
		this.end = 0

		this.arguments = null
		this.valueType = ValueType.None
	}
}

class UpdateExpression
{
	constructor() 
	{
		this.type = "UpdateExpression"
		this.start = 0
		this.end = 0

		this.valueType = ValueType.Number
		this.arg = null
		this.op = null
		this.prefix = null
	}
}

class New
{
	constructor(callee, args) {
		this.type = "New";
		this.callee = callee;
		this.args = args;
	}
}

class Null
{
	constructor() {
		this.type = "Null";
		this.start = 0;
		this.end = 0;		
	}
}

class FunctionDeclaration
{
	constructor() 
	{
		this.start = 0
		this.end = 0

		this.ref = null
		this.id = null
		this.params = null
		this.body = null
		this.generator = false
		this.expression = false
		this.resolved = false
		this.numCalled = 0
		this.returnValue = false

		this.valueType = ValueType.Function
		this.returnType = ValueType.Dynamic
	}
}

class FunctionExpression extends FunctionDeclaration
{}

class ArrowFunctionExpression extends FunctionDeclaration
{}

class Class
{
	constructor(id, superCls, body) {
		this.type = "Class";
		this.id = id;
		this.superCls = superCls; 
		this.body = body;
	}
}

class ClassBody
{
	constructor(buffer) {
		this.type = "ClassBody";
		this.buffer = buffer;
	}
}

class MethodDef
{
	constructor(key, value, kind, isStatic) {
		this.type = "MethodDef";
		this.key = key;
		this.value = value;
		this.kind = kind;
		this.isStatic = isStatic;
	}
}

class ThisExpression
{
	constructor() {
		this.type = "ThisExpression"
		this.start = 0
		this.end = 0		
	}
}

class Super
{
	constructor() {
		this.type = "Super"
		this.start = 0
		this.end = 0
	}
}

class BlockStatement
{
	constructor() {
		this.type = "BlockStatement"
		this.start = 0
		this.end = 0
		this.scope = new Scope()
	}
}

class ReturnStatement
{
	constructor() {
		this.type = "ReturnStatement"
		this.start = 0
		this.end = 0
		this.arg = null
	}
}

class IfStatement
{
	constructor(test, consequent, alternate) 
	{
		this.type = "IfStatement"
		this.start = 0
		this.end = 0

		this.test = test
		this.consequent = consequent
		this.alternate = alternate
	}
}

class Conditional
{
	constructor(test, consequent, alternate) {
		this.type = "Conditional";
		this.test = test;
		this.consequent = consequent;
		this.alternate = alternate;
	}
}

class Unary
{
	constructor(arg, op, prefix) {
		this.type = "Unary";
		this.arg = arg;
		this.op = op;
		this.prefix = prefix;
	}
}

class Switch
{
	constructor(cases, discriminant) {
		this.type = "Switch";
		this.cases = cases;
		this.discriminant = discriminant;
	}
}

class SwitchCase
{
	constructor(test, scope) {
		this.type = "SwitchCase";
		this.test = test;
		this.scope = scope;
	}
}

class Break
{
	constructor(label) {
		this.type = "Break"
		this.label = label
	}
}

class ForStatement
{
	constructor(init, test, update, body) 
	{
		this.type = "ForStatement"
		this.start = 0
		this.end = 0

		this.init = init
		this.test = test
		this.update = update
		this.body = body
	}
}

class ForIn
{
	constructor(left, right, body) {
		this.type = "ForIn";
		this.left = left;
		this.right = right;
		this.body = body;
	}
}

class While
{
	constructor(test, body) {
		this.type = "While";
		this.test = test;
		this.body = body;
	}
}

class DoWhile
{
	constructor(test, body) {
		this.type = "DoWhile";
		this.test = test;
		this.body = body;
	}
}

class Continue
{
	constructor() {
		this.type = "Continue";
	}
}

class Label
{
	constructor(name, body) {
		this.type = "Label";
		this.name = name;
		this.body = body;
	}
}

class SequenceExpression
{
	constructor() 
	{
		this.type = "SequenceExpression"
		this.start = 0
		this.end = 0

		this.exprs = []
	}
}

class Try
{
	constructor(block, handler, finalizer) {
		this.type = "Try"
		this.block = block
		this.handler = handler
		this.finalizer = finalizer
	}
}

class Throw 
{
	constructor(arg) {
		this.type = "Throw";
		this.arg = arg;
	}
}

class Catch
{
	constructor(param, body) {
		this.type = "Catch";
		this.param = param;
		this.body = body;
	}
}

class Import
{
	constructor(source, specifiers, sourceFile) {
		this.source = source
		this.specifiers = specifiers
		this.sourceFile = sourceFile
	}
}

class Specifier
{
	constructor(local, localAs, isDefault) {
		this.local = local
		this.localAs = localAs
		this.isDefault = isDefault
	}
}

class Export
{
	constructor(declaration) 
	{
		this.type = "Export"
		this.start = 0
		this.end = 0

		this.declaration = declaration
	}
}

class ExportDefaultDeclaration
{
	constructor(declaration) 
	{
		this.type = "ExportDefaultDeclaration"
		this.start = 0
		this.end = 0

		this.declaration = declaration
	}
}

class ExportAllDeclaration
{
	constructor(source) {
		this.source = source
	}
}

class AssignmentExpression 
{
	constructor(left, right, op) {
		this.type = "AssignmentExpression"
		this.left = left
		this.right = right
		this.op = op
	}
}

class BinaryExpression
{
	constructor(left, right, op) 
	{
		this.type = "BinaryExpression"
		this.start = 0
		this.end = 0	

		this.valueType = ValueType.Dynamic
		this.left = left
		this.right = right
		this.op = op
	}
}

class LogicalExpression 
{
	constructor(left, right, op) {
		this.type = "LogicalExpression"
		this.left = left
		this.right = right
		this.op = op
	}
}



class TemplateLiteral 
{
	constructor(expressions, quasis)
	{
		this.type = "TemplateLiteral";
		this.expressions = expressions;
		this.quasis = quasis;
	}
}

class EmptyStatement
{
	constructor() 
	{
		this.type = "EmptyStatement";
	}
}

class Property
{
	constructor(key, value, kind, computed) {
		this.key = key
		this.value = value
		this.kind = kind
		this.computed = computed
	}
}

class ObjectPattern
{
	constructor(properties) {
		this.properties = properties
	}
}

class AssignmentPattern
{
	constructor(left, right) {
		this.left = left
		this.right = right
	}
}

class XmlNode
{
	constructor() 
	{
		this.start = 0
		this.end = 0

		this.name = null
		this.content = null
		this.params = {}
		this.body = []
	}
}


module.exports = {
	Scope,
	Program,
	Identifier,
	Number,
	Bool,
	String,
	Name,
	Variable,
	VariableDeclaration,
	Array,
	Object,
	CallExpression,
	UpdateExpression,
	New,
	Null,
	FunctionExpression,
	FunctionDeclaration,
	Class,
	ClassBody,
	MethodDef,
	ThisExpression,
	Super,
	ExpressionStatement,
	BlockStatement,
	ReturnStatement,
	IfStatement,
	Conditional,
	Unary,
	Switch,
	SwitchCase,
	Break,
	ForStatement,
	ForIn,
	While,
	DoWhile,
	Continue,
	Label,
	SequenceExpression,
	Try,
	Throw,
	Catch,
	Import,
	Specifier,
	Export,
	AssignmentExpression,
	BinaryExpression,
	LogicalExpression,
	ArrowFunctionExpression,
	TemplateLiteral,
	EmptyStatement,
	ExportDefaultDeclaration,
	Property,
	ObjectPattern,
	AssignmentPattern,
	ExportAllDeclaration,
	XmlNode,
}
