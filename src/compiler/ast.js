const { ValueType } = require("./types")

function Scope() {
	this.body = []
	this.vars = {}
}

class Identifier
{
	constructor() {
		this.type = "Identifier"
		this.value = null
	}
}

class Number
{
	constructor(value) {
		this.type = "Number"
		this.valueType = ValueType.Number
		this.value = value
		this.start = 0
		this.end = 0
	}
}

class Bool
{
	constructor(value) {
		this.type = "Bool";
		this.value = value;
		this.start = 0;
		this.end = 0;
	}
}

class String
{
	constructor(value, raw) {
		this.type = "String"
		this.value = value
		this.valueType = ValueType.String
		this.raw = raw
		this.start = 0
		this.end = 0
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
		this.kind = null
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

class Call
{
	constructor(value, args) {
		this.type = "Call";
		this.value = value;
		this.args = args;
	}
}

class Update
{
	constructor(arg, op, prefix) {
		this.type = "Update";
		this.arg = arg;
		this.op = op;
		this.prefix = prefix;
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
	constructor() {
		this.type = "FunctionDeclaration"
		this.valueType = ValueType.Function
		this.id = null
		this.params = null
		this.body = null
		this.generator = false
		this.expression = false
	}
}

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

class Return
{
	constructor(arg) {
		this.type = "Return";
		this.arg = arg;
	}
}

class If
{
	constructor(test, consequent, alternate) {
		this.type = "If";
		this.test = test;
		this.consequent = consequent;
		this.alternate = alternate;
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

class For
{
	constructor(init, test, update, body) {
		this.type = "For";
		this.init = init;
		this.test = test;
		this.update = update;
		this.body = body;
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

class Sequence
{
	constructor(exprs) {
		this.type = "Sequence";
		this.exprs = exprs;
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
	constructor(decl) {
		this.decl = decl
	}
}

class ExportDefaultDeclaration
{
	constructor(decl) {
		this.decl = decl
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
	constructor(left, right, op) {
		this.type = "BinaryExpression"
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

class ArrowFunctionExpression 
{
	constructor(params, expression, generator, body)
	{
		this.type = "ArrowFunctionExpression";
		this.params = params;
		this.expression = expression;
		this.generator = generator;
		this.body = body;
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

module.exports = {
	Scope,
	Identifier,
	Number,
	Bool,
	String,
	Name,
	Variable,
	VariableDeclaration,
	Array,
	Object,
	Call,
	Update,
	New,
	Null,
	FunctionDeclaration,
	Class,
	ClassBody,
	MethodDef,
	ThisExpression,
	Super,
	BlockStatement,
	Return,
	If,
	Conditional,
	Unary,
	Switch,
	SwitchCase,
	Break,
	For,
	ForIn,
	While,
	DoWhile,
	Continue,
	Label,
	Sequence,
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
	ExportAllDeclaration
}
