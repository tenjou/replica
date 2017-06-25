const AST = require("../AST")
const { ValueType, ValueTypeStr } = require("../types")
const logger = require("../../logger")

let activeScope = null
let activeFunc = null

const run = function(file) {
	parse.BlockDeclaration(file.blockNode)
}

const parse =
{
	Number(node) {
		return node.valueType
	},

	String(node) {
		return node.valueType
	},

	Identifier(node) 
	{
		const variable = getFromIdentifier(node)
		if(!variable) {
			logger.logError("IdentifierError:", `‘${node.value}’ was not declared in this scope`)
			return 0
		}
		
		return variable.valueType
	},

	BlockDeclaration(node)
	{
		const prevScope = activeScope
		activeScope = node.scope

		const body = node.scope.body
		for(let n = 0; n < body.length; n++) {
			const bodyNode = body[n]
			parse[bodyNode.type](bodyNode)
		}

		activeScope = prevScope
	},

	Variable(node) 
	{
		const exprValueType = parse[node.expr.type](node.expr)

		if(node.valueType !== ValueType.Dynamic && node.valueType !== exprValueType) {
			logger.logError("TypeError", `invalid conversion from '${ValueTypeStr[node.valueType]}' to '${ValueTypeStr[exprValueType]}'`)
			return
		}

		node.valueType = exprValueType
	},

	VariableDeclaration(node)
	{
		const decls = node.decls
		for(let n = 0; n < decls.length; n++) {
			const decl = decls[n]
			parse[decl.type](decl)
			activeScope.vars[decl.id.value] = decl
		}
	},

	AssignmentExpression(node) 
	{
		const leftType = parse[node.left.type](node.left)
		const rightType = parse[node.right.type](node.right)

		if(leftType && rightType && leftType !== rightType) {
			logger.logError("TypeError", `invalid conversion from '${ValueTypeStr[leftType]}' to '${ValueTypeStr[rightType]}'`)
			return node.valueType
		}
		else {
			node.valueType = leftType
		}

		return node.valueType
	},

	BinaryExpression(node) 
	{
		const leftType = parse[node.left.type](node.left)
		const rightType = parse[node.right.type](node.right)

		if(leftType && rightType && leftType !== rightType) 
		{
			if(leftType === ValueType.String || rightType === ValueType.String) {
				node.valueType = ValueType.String
			}
			else {
				logger.logError("TypeError", `invalid conversion from '${ValueTypeStr[leftType]}' to '${ValueTypeStr[rightType]}'`)
			}
		}
		else 
		{
			if(leftType === ValueType.String || rightType === ValueType.String) {
				node.valueType = ValueType.String
			}
			else {
				node.valueType = leftType
			}
		}

		return node.valueType
	},

	IfStatement(node)
	{
		parse[node.test.type](node.test)
		parse.BlockDeclaration(node.consequent)
	},

	FunctionDeclaration(node) 
	{
		const prevActiveFunc = activeFunc
		activeFunc = node

		const scopeNode = activeScope.vars[node.id.value]
		if(scopeNode) {
			logger.logError("Error", `redeclaration of ${node.id.value}:${node.returnType}`)
			return
		}

		activeScope.vars[node.id.value] = node

		const prevScope = activeScope
		activeScope = node.body.scope
		parse.Params(node.params)
		activeScope = prevScope

		parse.BlockDeclaration(node.body)

		activeFunc = prevActiveFunc
	},

	Params(params)
	{
		for(let n = 0; n < params.length; n++) {
			const param = params[n]
			activeScope.vars[param.value] = param
		}
	},

	ReturnStatement(node) 
	{
		if(node.arg) 
		{
			parse[node.arg.type](node.arg)

			if(activeFunc.returnType !== node.arg.valueType) 
			{
				if(activeFunc.returnType !== ValueType.Dynamic) {
					logger.logError("TypeError", `invalid conversion for return value from '${ValueTypeStr[activeFunc.valueType]}' to '${node.arg.valueType}'`)
				}
				else {
					node.valueType = node.arg.valueType
					activeFunc.returnType = node.arg.valueType
				}
			}

			return node.arg.valueType
		}

		return ValueType.None
	},

	CallExpression(node)
	{
		const func = getFromIdentifier(node.callee)
		node.valueType = func.returnType

		if(node.arguments) {
			parse.Arguments(node.arguments)
		}

		return func.returnType
	},

	Arguments(args)
	{
		for(let n = 0; n < args.length; n++) {
			const arg = args[n]
			parse[arg.type](arg)
		}
	},

	ExportDefaultDeclaration(node) {
		const scopeNode = parse[node.declaration.type](node.declaration)
		return ValueType.None
	}
}

const getName = function(node)
{
	switch(node.type)
	{
		case "Identifier":
			return node.value
	}

	return null
}

const getFromIdentifier = function(node)
{
	let scope = activeScope
	while(scope) 
	{
		const scopeVar = scope.vars[node.value]
		if(scopeVar) { 
			return scopeVar
		}

		scope = scope.parent
	}

	return null
}

module.exports = {
	run
}