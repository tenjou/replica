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

	if(scope.process) {
		scope.process.env = { NODE_ENV: "dev" }
	}
	else
	{
		scope.process = {
			env: {
				NODE_ENV: "dev"
			}
		}
	}

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
		a.__parent = b;

		if(b.__inherit === undefined) {
			b.__inherit = {};
		}

		b.__inherit[a.name] = a;

		var parent = b.__parent;
		while(parent)
		{
			parent.__inherit[a.name] = a;
			parent = parent.__parent;
		}
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

function doCompile(file, flags)
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
		result += compile.Block(file.blockNode, compileSourceExports);
		result += ")();\n\n"
		result += `//# sourceURL=${relativePath}`

		decTabs();
	}
	else {
		result += compile.Block(file.blockNode);
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
			result += compile[node.type](node) + ";";
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
		const result = compile.Specifier(node)
		return result;
	}
	else if(node instanceof AST.Identifier) {
		return node.value;
	}
	else if(node instanceof AST.Name) {
		return compile.Name(node)
	}
	else if(node instanceof AST.Call) {
		return compile[node.value.type](node.value)
	}

	return null;
}

const lookup = (node) => {
	if(!node) { return "" }
	return compile[node.constructor.name](node)
}

const compile =
{
	Identifier(node) {
		return node ? node.value : null
	},

	Number(node) {
		return node ? node.value : null
	},

	Bool(node) {
		return node.value ? "true" : "false"
	},

	String(node) {
		return node.raw
	},

	New(node)
	{
		let callee = lookup(node.callee)
		if(node.callee.type === "Conditional") {
			callee = "(" + callee + ")"
		}

		const result = "new " + callee +
			"(" + this.Args(node.args) + ")"

		return result
	},

	Null(node) {
		return "null"
	},

	Name(node)
	{
		let result = ""

		const parentNode = node.parent
		if(parentNode)
		{
			if(parentNode.type !== "Identifier" &&
			parentNode.type !== "Call" &&
			parentNode.type !== "ThisExpression" &&
			parentNode.type !== "Name" &&
			parentNode.type !== "Super")
			{
				result += "(" + lookup(parentNode) + ")"
			}
			else {
				result += lookup(parentNode)
			}
		}

		if(node.computed) {
			result += "[" + lookup(node.value) + "]"
		}
		else {
			result += "." + lookup(node.value)
		}

		return result
	},

	VariableDeclaration(node)
	{
		const decls = node.decls

		let result = node.kind + " " + this.VariableNode(decls[0])

		for(let n = 1; n < decls.length; n++) {
			result += ", " + this.VariableNode(decls[n])
		}

		return result
	},

	VariableNode(node)
	{
		const declName = lookup(node.value)

		if(node.expr) {
			let result = declName + " = " + lookup(node.expr)
			return result;
		}

		return declName;
	},

	VariableNode(node)
	{
		const declName = lookup(node.value)

		if(node.expr) {
			let result = declName + " = " + lookup(node.expr)
			return result
		}

		return declName
	},

	Array(node)
	{
		const elements = node.value;
		if(elements.length === 0) { return "[]" }

		let elementNode = elements[0]
		let result = "[ " + lookup(elementNode)

		for(let n = 1; n < elements.length; n++) {
			elementNode = elements[n]
			result += ", " + lookup(elementNode)
		}

		result += " ]"
		return result
	},

	Object(node)
	{
		const props = node.value
		if(props.length === 0) { return "{}" }

		let propsNode = props[0]
		let result = "{\n"

		incTabs()

		result += tabs + this.ObjectMember(propsNode)

		for(let n = 1; n < props.length; n++) {
			propsNode = props[n]
			result += ",\n" + tabs + this.ObjectMember(propsNode)
		}

		decTabs()

		result += `\n${tabs}}`
		return result
	},

	ObjectMember(node)
	{
		let key = lookup(node.key)

		if(node.computed) {
			key = `[${key}]`
		}

		if(node.kind && node.kind !== "init")
		{
			let value;
			if(node.value instanceof AST.Function) {
				value = this.Function(node.value, true)
			}
			else {
				value = lookup(node.value)
			}

			result = node.kind + " " + key + value
		}
		else
		{
			const value = lookup(node.value)
			result = key + ": " + value
		}

		return result
	},

	Binary(node)
	{
		let result

		if(node.left instanceof AST.Binary ||
		node.left instanceof AST.Conditional) {
			result = "(" + lookup(node.left) + ")"
		}
		else {
			result = lookup(node.left)
		}

		result += " " + node.op + " "

		if(node.right instanceof AST.Binary ||
		node.right instanceof AST.Conditional)
		{
			result += "(" + lookup(node.right) + ")"
		}
		else {
			result += lookup(node.right)
		}

		return result
	},

	Update(node)
	{
		let result

		if(node.prefix) {
			result = node.op + lookup(node.arg)
		}
		else {
			result = lookup(node.arg) + node.op
		}

		return result
	},

	Call(node)
	{
		if(context.flags.transpiling) {
			return this.Call_ecma5(node)
		}

		return this.Call_ecma6(node)
	},

	Call_ecma5(node)
	{
		const value = lookup(node.value)
		const args = this.Args(node.args)

		let result

		if(node.value.type === "Super" ||
		(node.value.type == "Name" && node.value.parent.type === "Super"))
		{
			result = value + ".call(this"
			if(args) {
				result += ", " + args
			}
			result += ")";
		}
		else if(node.value instanceof AST.Function) {
			result = `(${value}) (${args})`
		}
		else {
			result = value + "(" + args + ")"
		}

		return result
	},

	Call_ecma6(node) {
		let result = lookup(node.value)
		result += "(" + this.Args(node.args) + ")"
	},

	Args(args)
	{
		if(args.length === 0) { return "" }

		let node = args[0]
		let result = lookup(node)

		for(let n = 1; n < args.length; n++) {
			node = args[n]
			result += ", " + lookup(node)
		}

		return result
	},

	Function(node, withoutFunc, funcName)
	{
		if(!funcName)
		{
			funcName = lookup(node.id)
			if(funcName) {
				funcName = " " + funcName
			}
		}
		else {
			funcName = " " + funcName
		}

		let result = ""
		if(!withoutFunc) {
			result = "function"
		}

		result += funcName + "(" + this.Args(node.params) + ") " +
			this.Block(node.body)

		return result
	},

	Block(node, appendFunc)
	{
		incTabs()

		let blockResult = ""
		const body = node.scope.body
		for(let n = 0; n < body.length; n++)
		{
			let node = body[n]
			let nodeResult = lookup(node)
			if(!nodeResult) {
				continue
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
				blockResult += tabs + nodeResult + ";\n"
			}
			else {
				blockResult += tabs + nodeResult + "\n"
			}
		}

		if(appendFunc)
		{
			let appendResult = appendFunc()
			if(appendResult) {
				blockResult += `${tabs}${appendResult}\n`
			}
		}

		decTabs()

		if(numTabs)
		{
			if(!blockResult) {
				return "{}"
			}
			else {
				return "{\n" + blockResult + tabs + "}"
			}
		}

		return blockResult
	},

	Return(node)
	{
		let content = lookup(node.arg)
		let result = "return"
		if(content !== null) {
			result += " " + content
		}

		return result
	},

	If(node)
	{
		let result = "if(" + lookup(node.test) + ") "

		if(node.consequent.type !== "Block")
		{
			incTabs()
			result += lookup(node.consequent) + ";\n"
			decTabs()
		}
		else {
			result += lookup(node.consequent)
		}

		if(node.alternate)
		{
			if(node.alternate.type === "If")
			{
				result += "\n" + tabs + "else " + this.If(node.alternate)
			}
			else
			{
				result += "\n" + tabs + "else ";

				if(node.alternate.type !== "Block")
				{
					incTabs();
					result += lookup(node.alternate) + ";\n"
					decTabs();
				}
				else {
					result += lookup(node.alternate)
				}

				result += tabs
			}
		}

		return result
	},

	Conditional(node) {
		const result = lookup(node.test) + " ? " +
			lookup(node.consequent) + " : " +
			lookup(node.alternate)
		return result
	},

	Unary(node)
	{
		let arg = lookup(node.arg)

		if(node.arg instanceof AST.Binary ||
			node.arg instanceof AST.LogicalExpression ||
			node.op === "void")
		{
			arg = "(" + arg + ")"
		}

		let op = node.op
		if(op === "typeof" || op === "delete") {
			op += " "
		}

		let result
		if(node.prefix) {
			result = op + arg
		}
		else {
			result = arg + op
		}

		return result
	},

	Switch(node)
	{
		let result = "switch(" + lookup(node.discriminant) + ") {\n"

		incTabs()

		result += this.SwitchCases(node.cases)

		decTabs()

		result += tabs + "}"

		return result
	},

	SwitchCases(cases)
	{
		let result = ""

		for(let n = 0; n < cases.length; n++) {
			let node = cases[n]
			result += this.SwitchCase(node)
		}

		return result
	},

	SwitchCase(node)
	{
		let result = tabs

		if(!node.test) {
			result += "default:\n"
		}
		else {
			result += "case " + lookup(node.test) + ":\n"
		}

		incTabs()

		let prevNode = null
		const buffer = node.scope.body
		for(let n = 0; n < buffer.length; n++)
		{
			let bufferNode = buffer[n]
			if(bufferNode instanceof AST.Block) {
				decTabs()
				result += tabs + this.Block(bufferNode)
				incTabs()
			}
			else
			{
				if(prevNode && prevNode instanceof AST.Block) {
					result += " " + lookup(bufferNode) + ";\n"
				}
				else {
					result += tabs + lookup(bufferNode) + ";\n"
				}
			}

			prevNode = bufferNode
		}

		decTabs()

		return result
	},

	Break(node) {
		const output = node.label ? `break ${this.Identifier(node.label)}` : "break"
		return output
	},

	For(node)
	{
		const init = node.init ? lookup(node.init) : ""
		const test = node.test ? "; " + lookup(node.test) : ";"
		const update = node.update ? "; " + lookup(node.update) : ";"
		const body = lookup(node.body)

		const result = `for(${init}${test}${update}) ${body}`
		return result
	},

	ForIn(node) {
		let result = "for(" +
			lookup(node.left) + " in " +
			lookup(node.right) + ") " +
			lookup(node.body)
		return result
	},

	While(node)
	{
		if(node.body instanceof AST.EmptyStatement) {
			return ""
		}

		const result = "while(" +
			lookup(node.test) + ") " +
			lookup(node.body)
		return result
	},

	DoWhile(node)
	{
		const result = "do " +
			lookup(node.body) +
			" while(" + lookup(node.test) + ")"
		return result
	},

	Continue(node)
	{
		if(node.label) {
			return `continue ${lookup(node.label)}`
		}
		return "continue"
	},

	Label(node)
	{
		let result = lookup(node.name) + `:\n${tabs}` +
			lookup(node.body)
		return result
	},

	Sequence(node)
	{
		const exprs = node.exprs

		let exprNode = exprs[0]
		let result = lookup(exprNode)

		for(let n = 1; n < exprs.length; n++) {
			exprNode = exprs[n]
			result += ", " + lookup(exprNode)
		}

		return result
	},

	Try(node)
	{
		let result = "try " + this.Block(node.block)

		if(node.handler) {
			const handler = node.handler
			result += "\n" + tabs + "catch(" + lookup(handler.param) + ") " + this.Block(handler.body)
		}
		if(node.finalizer) {
			result += "\n" + tabs + "finally " + this.Block(node.finalizer)
		}

		return result
	},

	Throw(node) {
		const result = "throw " + lookup(node.arg)
		return result
	},

	Import(node)
	{
		const specifiers = node.specifiers

		let value = node.source.value
		if(value[0] === ".")
		{
			if(!path.extname(value)) {
				value += ".js"
			}
		}
		value = value.toLowerCase()

		let result

		if(context.flags.transpiling)
		{
			const numSpecifiers = specifiers.length
			if(numSpecifiers === 0) { return }

			const moduleExportsFile = `modules[${node.sourceFile.id}]`

			if(numSpecifiers === 1)
			{
				const specifier = specifiers[0]
				const localAs = this.Identifier(specifier.localAs)
				const local = specifiers.local ? this.Identifier(specifier.local) : localAs

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
					const local = this.Identifier(specifier.local)

					if(specifier.isDefault) {
						result += `;\n${tabs}var ${local} = ${filename}`
					}
					else {
						const localAs = specifier.localAs ? this.Identifier(specifier.localAs) : local
						result += `;\n${tabs}var ${localAs} = ${filename}.${local}`
					}
				}
			}
		}
		else
		{
			result += "import " +
				this.Specifiers(specifiers) +
				" from " +
				lookup(node.source)
		}

		return result
	},

	Specifiers(specifiers)
	{
		if(!node.localAs) {
			return lookup(node.local)
		}

		let result = "{ " + this.Specifier(node)

		for(let n = 1; n < specifiers.length; n++) {
			node = specifiers[n]
			result += ", " + this.Specifier(node)
		}

		result += " }"

		return result
	},

	Specifier(node)
	{
		if(node.localAs) {
			return lookup(node.localAs) + ": " + lookup(node.local)
		}

		return lookup(node.local)
	},

	Export(node)
	{
		if(context.flags.transpiling) {
			return lookup(node.decl)
		}

		return "export " + lookup(node.decl)
	},

	Class(node)
	{
		if(context.flags.transpiling) {
			return this.Class_ecma5(node)
		}

		return this.Class_ecma6(node)
	},

	Class_ecma5(node)
	{
		clsCtx.inside = true
		clsCtx.id = lookup(node.id)
		clsCtx.superCls =lookup(node.superCls)

		let result = this.ClassBody_ecma5(node.body)

		if(clsCtx.superCls) {
			requirements.inherits = true
			result += "\n" + tabs + "_inherits(" + clsCtx.id + ", " + clsCtx.superCls + ");\n"
		}

		clsCtx.inside = false

		return result
	},

	Class_ecma6(node)
	{
		let result = "class " + clsCtx.id

		if(clsCtx.superCls) {
			result += " extends " + lookup(clsCtx.superCls)
		}

		result += " {\n"

		incTabs()
		result += this.ClassBody_ecma6(node.body)
		decTabs()

		result += tabs + "}"

		return result
	},

	ClassBody_ecma6(node)
	{
		let result = ""

		const buffer = node.buffer
		for(let n = 0; n < buffer.length; n++) {
			let bufferNode = buffer[n]
			result += tabs + this.MethodDef(bufferNode, true) + "\n"
		}

		return result
	},

	ClassBody_ecma5(node)
	{
		let constrResult
		let proto = ""

		incTabs()

		const buffer = node.buffer
		for(let n = 0; n < buffer.length; n++)
		{
			const bufferNode = buffer[n]

			if(bufferNode.kind === "constructor") {
				decTabs()
				clsCtx.insideConstr = true
				constrResult = this.Function(bufferNode.value, false, clsCtx.id) + "\n"
				clsCtx.insideConstr = false
				incTabs()
			}
			else
			{
				const protoDecl = proto ? ",\n" : ""
				proto += protoDecl + tabs + this.MethodDef_ecma5(bufferNode)
			}
		}

		decTabs()

		if(!constrResult) {
			constrResult = "function " + clsCtx.id + "() {};\n"
		}

		if(proto) {
			proto = tabs + clsCtx.id + ".prototype = {\n" + proto + "\n" + tabs + "};\n"
		}

		const result = constrResult + proto
		return result
	},

	MethodDef_ecma6(node)
	{
		const key = lookup(node.key)

		let result = ""
		if(node.kind === "get" || node.kind === "set") {
			result = node.kind + " "
		}
		result += key + this.Function(node.value, true)

		return result
	},

	MethodDef_ecma5(node)
	{
		const key = lookup(node.key)

		let result = ""
		if(node.kind === "get" || node.kind === "set") {
			result = node.kind + " " + key + this.Function(node.value, true)
		}
		else {
			result = key + ": " + this.Function(node.value, false)
		}

		return result
	},

	ThisExpression(node) {
		return "this"
	},

	LogicalExpression(node)
	{
		let left = lookup(node.left)
		let right = lookup(node.right)
		let result

		if(node.left instanceof AST.Binary ||
		node.left instanceof AST.LogicalExpression)
		{
			if(node.right instanceof AST.Binary ||
			node.right instanceof AST.LogicalExpression)
			{
				result = `(${left}) ${node.op} (${right})`
			}
			else {
				result = `(${left}) ${node.op} ${right}`
			}
		}
		else if(node.right instanceof AST.Binary ||
				node.right instanceof AST.LogicalExpression)
		{
			result = `${left} ${node.op} (${right})`
		}
		else {
			result = `${left} ${node.op} ${right}`
		}

		return result
	},

	ArrowFunctionExpression(node)
	{
		const body = lookup(node.body)
		let result = "(" + this.Args(node.params) + ") => "
		if(node.body instanceof AST.Block) {
			result += body
		}
		else {
			result += `(${body})`
		}

		return result
	},

	Super(node)
	{
		if(context.flags.transpiling) {
			return this.Super_ecma5(node)
		}

		const result = "super"
		return result
	},

	Super_ecma5(node)
	{
		let result

		if(clsCtx.insideConstr) {
			result = clsCtx.superCls
		}
		else {
			result = clsCtx.superCls + ".prototype"
		}

		return result
	},

	TemplateLiteral(node)
	{
		let result = "\""

		const expressions = node.expressions
		const quasis = node.quasis
		const num = quasis.length - 1

		if(num === 0) {
			result += this.Quasis(quasis[0])
		}
		else
		{
			for(let n = 0; n < quasis.length - 1; n++) {
				const expr = expressions[n]
				result += this.Quasis(quasis[n]) + "\" + " + lookup(expr) + " + \"";
			}

			result += quasis[num].value
		}

		result += "\""

		return result
	},

	Quasis(node)
	{
		let result = node.value.replace(/\n/g, "\\n")
							.replace(/\t/g, "\\t")
							.replace(/\"/g, "\\\"")
		return result
	},

	EmptyStatement(node) {
		return ""
	},

	ExportSpecifier(node)
	{
		let result

		if(node.local.value === node.exported.value) {
			result = node.local.value
		}
		else {
			result = node.exported.value + ": " + node.local.value
		}

		return result
	},

	// TODO: Temporary solution
	ExportDefaultDeclaration(node)
	{
		const decl = node.decl

		let result = `modules[${context.currSourceFile.id}] = `

		if(decl instanceof AST.Binary) {
			result += lookup(decl.right)
		}
		else if(decl instanceof AST.Class) {
			result = lookup(decl) + tabs + result + lookup(decl.id)
		}
		else {
			result += lookup(decl)
		}

		return result
	},

	ExportAllDeclaration(node) {

	},

	ObjectPattern(node)
	{
		let result = "{ "

		const properties = node.properties
		if(properties.length > 0)
		{
			const prop = properties[0]
			result += lookup(prop)

			for(let n = 1; n < properties.length; n++) {
				const prop = properties[n]
				result += ", " + lookup(prop)
			}
		}

		result += " }"
		return result
	},

	AssignmentPattern(node) {
		const result = `${lookup(node.left)} = ${lookup(node.right)}`
		return result
	},

	DebuggerStatement(node) {
		return "debugger"
	},

	Property(node) 
	{
		if(node.value instanceof AST.AssignmentPattern) {
			return lookup(node.value)
		}
		return lookup(node.key)
	}
}

const incTabs = () => {
	numTabs++
	if(numTabs > 1) {
		tabs += "\t"
	}
}

const decTabs = () => {
	if(numTabs > 1) {
		tabs = tabs.slice(0, -1)
	}
	numTabs--
}

module.exports = {
	compile: doCompile
}
