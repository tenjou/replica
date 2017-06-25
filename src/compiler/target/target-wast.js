const { ValueType } = require("../types")

let globalScope = null
let activeScope = null
let numTabs = 0
let tabs = ""

const compile = function(flags, file) 
{
	activeScope = file.blockNode.scope
	globalScope = activeScope

	let result = "(module\n"
	result += parse.Body(file.blockNode.body)
	result += ")"

	return result
}

const parse = 
{
	Identifier(node) 
	{
		if(isIdentifierGlobal(node)) {
			return `${tabs}(get_global $${node.value})\n`
		}

		return `${tabs}(get_local $${node.value})\n`
	},

	Number(node) {
		return `${tabs}(${types[ValueType.Number]}.const ${node.value})\n`
	},

	Body(body)
	{
		incTabs()

		let result = ""

		for(let n = 0; n < body.length; n++) {
			const node = body[n]
			result += parse[node.type](node)
		}

		decTabs()
		
		return result
	},

	BlockStatement(block) 
	{
		const prevScope = activeScope
		activeScope = block.scope
		
		const result = parse.Body(block.scope.body)

		activeScope = prevScope
		return result
	},

	IfStatement(node)
	{
		let result = `${tabs}(if\n`

		incTabs()

		result += parse[node.test.type](node.test)

		result += `${tabs}(then\n`
		result += parse[node.consequent.type](node.consequent)
		result += `${tabs})\n`

		decTabs()

		result += `${tabs})\n`
		return result
	},

	BinaryExpression(node) 
	{
		let result = `${tabs}(${types[node.valueType]}.${ops[node.op]}\n`

		incTabs()
		result += parse[node.left.type](node.left)
		result += parse[node.right.type](node.right)
		decTabs()

		result += `${tabs})\n`
		
		return result
	},

	CallExpression(node) 
	{
		let result = `${tabs}(call $${createLinkName(node.callee.value)}\n`

		if(node.arguments) {
			incTabs()
			result += parse.Args(node.arguments)
			decTabs()
		}

		result += `${tabs})\n`

		return result
	},

	Args(args)
	{
		let result = ""

		for(let n = 0; n < args.length; n++) {
			const arg = args[n]
			result += parse[arg.type](arg)
		}

		return result
	},

	VariableDeclaration(node) 
	{
		let result = ""
		const decls = node.decls
		const isConst = (node.kind === "const") ? true : false

		if(activeScope === globalScope)
		{
			for(let n = 0; n < decls.length; n++) {
				const decl = decls[n]
				result += parse.GlobalVariable(decl, isConst)
			}
		}
		else
		{
			for(let n = 0; n < decls.length; n++) {
				const decl = decls[n]
				result += `${tabs}(local $${decl.id.value} ${types[decl.valueType]})\n`
			}

			for(let n = 0; n < decls.length; n++) {
				const decl = decls[n]
				result += parse.LocalVariable(decl, isConst)
			}
		}

		return result
	},

	GlobalVariable(node, isConst)
	{
		const type = isConst ? types[node.valueType] : `(mut ${types[node.valueType]})`
		let result = `${tabs}(global $${node.id.value} ${type}\n`

		incTabs()
		result += parse[node.expr.type](node.expr)
		decTabs()

		result += `${tabs})\n`
		return result
	},

	LocalVariable(node, isConst) 
	{
		let result = `${tabs}(set_local $${node.id.value}\n`

		incTabs()
		result += parse[node.expr.type](node.expr)
		decTabs()
		result += `${tabs})\n`

		return result
	},

	FunctionDeclaration(node) 
	{
		const params = node.params ? createParams(node.params) : ""
		const returnType = node.returnType ? ` (result ${types[node.returnType]})` : ""

		let result = `${tabs}(func $${createLinkName(node.id.value)}${params}${returnType}\n`
		result += parse.BlockStatement(node.body)
		result += `${tabs})\n`

		return result
	},

	ReturnStatement(node)
	{
		let result = ""

		if(node.arg) {
			result = `${parse[node.arg.type](node.arg)}`
		}

		result += `${tabs}(return)\n`

		return result
	},

	ExportDefaultDeclaration(node)
	{
		const linkName = createLinkName(node.declaration.value)

		let typedLinkName
		const scopeNode = activeScope.vars[node.declaration.value]
		if(scopeNode.valueType === ValueType.Function) {
			typedLinkName = `(func $${linkName})`
		}
		else {
			typedLinkName = linkName
		}

		return `${tabs}(export "${linkName}" ${typedLinkName})\n`
	}
}

const isIdentifierGlobal = function(node)
{
	let scope = activeScope
	while(scope !== globalScope) 
	{
		const scopeVar = scope.vars[node.value]
		if(scopeVar) { 
			return false
		}

		scope = scope.parent
	}

	return true
}

const createLinkName = function(name) {
	return `_Z${name.length}${name}`
}

const createParams = function(params) 
{
	let result = ""
	for(let n = 0; n < params.length; n++) {
		const param = params[n]
		result += ` (param $${param.value} ${types[param.valueType]})`
	}

	return result
}

const types = {}
types[ValueType.Number] = "i32"

const ops = {
	"+": "add",
	"-": "sub",
	"*": "mul",
	"/": "div_s",
	"%": "rem_s",
	"<": "lt_s",
	"<=": "le_s",
	">": "gt_s",
	">=": "ge_s"
}

const incTabs = function()
{
	numTabs++
	if(numTabs > 0) {
		tabs += "\t"
	}
}

const decTabs = function()
{
	if(numTabs > 0) {
		tabs = tabs.slice(0, -1)
	}
	numTabs--
}

module.exports = {
	compile
}