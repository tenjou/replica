
// const Flag = {
// 	UNKNOWN: 0 << 1,
// 	EXPORTED: 1 << 1,
// 	DEFAULT: 2 << 1
// };

class Identifier
{
	constructor(value) {
		this.type = "Identifier";
		this.value = value;
	}
}

class Number
{
	constructor(value) {
		this.type = "Number";
		this.value = value;
		this.start = 0;
		this.end = 0;		
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
		this.type = "String";
		this.value = value;
		this.raw = raw;
		this.start = 0;
		this.end = 0;
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
	constructor(value, expr, kind) {
		this.type = "Variable";
		this.value = value;
		this.expr = expr;
		this.kind = kind || null;
	}
}

class VariableDeclaration
{
	constructor(decls, kind) {
		this.type = "VariableDeclaration";
		this.decls = decls;
		this.kind = kind;
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

class ObjectMember
{
	constructor(key, value, kind) {
		this.type = "ObjectMember";
		this.key = key;
		this.value = value;
		this.kind = kind || null;
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

class Binary
{
	constructor(left, right, op) {
		this.type = "Binary";
		this.left = left;
		this.right = right;
		this.op = op;
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

class Function
{
	constructor(id, params, body) {
		this.type = "Function";
		this.id = id;
		this.params = params;
		this.body = body;
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
		this.type = "ThisExpression";
		this.start = 0;
		this.end = 0;		
	}
}

class Super
{
	constructor() {
		this.type = "Super";
		this.start = 0;
		this.end = 0;
	}
}

class Block
{
	constructor(scope) {
		this.type = "Block";
		this.scope = scope;
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
	constructor() {
		this.type = "Break";
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
	constructor(block, handler) {
		this.type = "Try";
		this.block = block;
		this.handler = handler;
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
	constructor(source, specifiers, imported, sourceFile) {
		this.type = "Import";
		this.source = source;
		this.specifiers = specifiers;
		this.imported = imported;
		this.sourceFile = sourceFile;
	}
}

class ImportSpecifier
{
	constructor(imported, local) {
		this.type = "ImportSpecifier";
		this.imported = imported;
		this.local = local;
	}
}

class Export
{
	constructor(decl) {
		this.type = "Export";
		this.decl = decl;
	}
}

class ExportDefaultDeclaration
{
	constructor(decl) {
		this.type = "ExportDefaultDeclaration";
		this.decl = decl;
	}
}

class LogicalExpression 
{
	constructor(left, right, op)
	{
		this.type = "LogicalExpression";
		this.left = left;
		this.right = right;
		this.op = op;
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

class ExportSpecifier
{
	constructor(local, exported)
	{
		this.type = "ExportSpecifier";
		this.local = local;
		this.exported = exported;
	}
}

module.exports = {
	Identifier,
	Number,
	Bool,
	String,
	Name,
	Variable,
	VariableDeclaration,
	Array,
	Object,
	ObjectMember,
	Call,
	Binary,
	Update,
	New,
	Null,
	Function,
	Class,
	ClassBody,
	MethodDef,
	ThisExpression,
	Super,
	Block,
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
	ImportSpecifier,
	Export,
	LogicalExpression,
	ArrowFunctionExpression,
	TemplateLiteral,
	EmptyStatement,
	ExportSpecifier,
	ExportDefaultDeclaration
};
