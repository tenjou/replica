const AST = require("../ast")
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

		node.ref = variable
		
		return variable.valueType
	},

	BlockDeclaration(node)
	{
		const prevScope = activeScope
		activeScope = node.scope

		const body = node.scope.body
		for(let n = 0; n < body.length; n++) 
		{
			const bodyNode = body[n]

			if(bodyNode instanceof AST.FunctionDeclaration) {
				parse.FunctionDefinition(bodyNode)
				body[n] = null
				continue
			}
			
			const newBodyNode = parseNode(bodyNode)
			if(bodyNode !== newBodyNode) {
				body[n] = newBodyNode
			}
		}

		activeScope = prevScope
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

	ArrowFunctionExpression(node)
	{

	},

	IfStatement(node)
	{
		parseNode(node.test)
		parse.BlockDeclaration(node.consequent)
	},

	VariableDeclaration(node)
	{
		let handled = 0
		const decls = node.decls
		for(let n = 0; n < decls.length; n++) 
		{
			const decl = decls[n]
			if(decl.expr instanceof AST.FunctionExpression ||
			   decl.expr instanceof AST.ArrowFunctionExpression) 
			{
				decl.expr.id = decl.id
				decls[n] = null
				activeScope.vars[decl.id.value] = decl.expr
				activeScope.funcs[decl.id.value] = decl.expr
			}
			else {
				handled++
				parse[decl.type](decl)
				activeScope.vars[decl.id.value] = decl
			}
		}

		if(!handled) {
			return null
		}

		return node
	},

	Variable(node) 
	{
		const exprValueType = parseNode(node.expr)

		if(node.valueType !== ValueType.Dynamic && node.valueType !== exprValueType) {
			logger.logError("TypeError", `invalid conversion from '${ValueTypeStr[node.valueType]}' to '${ValueTypeStr[exprValueType]}'`)
			return
		}

		node.valueType = exprValueType
	},

	FunctionExpression(node)
	{

	},

	FunctionDefinition(node)
	{
		const scopeNode = activeScope.vars[node.id.value]
		if(scopeNode) {
			logger.logError("Error", `redeclaration of ${node.id.value}:${node.returnType}`)
			return
		}

		activeScope.vars[node.id.value] = node
		activeScope.funcs[node.id.value] = node
	},

	FunctionDeclaration(node) 
	{
		const prevActiveFunc = activeFunc
		activeFunc = node

		const prevScope = activeScope
		activeScope = node.body.scope
		parse.Params(node.params)
		activeScope = prevScope

		parse.BlockDeclaration(node.body)

		activeFunc = prevActiveFunc

		node.resolved = true
	},

	Params(params)
	{
		for(let n = 0; n < params.length; n++) {
			const param = params[n]
			activeScope.vars[param.value] = param
		}
	},

	ExpressionStatement(node) {
		return parse[node.expr.constructor.name](node.expr)
	},

	ReturnStatement(node) 
	{
		if(node.arg) 
		{
			const valueType = parseNode(node.arg)

			const funcReturnType = activeFunc.returnType
			if(funcReturnType !== valueType) 
			{
				if(valueType === ValueType.Dynamic) {
					node.arg.ref.valueType = funcReturnType
				}
				else if(funcReturnType === ValueType.Dynamic) {
					node.valueType = valueType
					activeFunc.returnType = valueType
				}
				else {
					logger.logError("TypeError", `invalid conversion for return value from '${ValueTypeStr[funcReturnType]}' to '${ValueTypeStr[node.arg.valueType]}'`)
				}
			}

			activeFunc.returnValue = true

			return node.arg.valueType
		}

		return ValueType.None
	},

	ForStatement(node)
	{
		if(node.init) {
			parse[node.init.type](node.init)
		}
		if(node.test) {
			parse[node.test.type](node.test)
		}
	},

	CallExpression(node)
	{
		const func = getFromIdentifier(node.callee)
		if(!(func instanceof AST.FunctionDeclaration || 
		     func instanceof AST.FunctionExpression ||
			 func instanceof AST.ArrowFunctionExpression))
		{
			logger.raise(`error: ${node.callee.value}' cannot be used as a function`)	
		}

		const params = func.params
		const args = node.arguments

		if(args) 
		{
			if(params.length < args.length) {
				logger.raise(`error: too many arguments to function '${node.callee.value}'`)
			}

			parse.Arguments(func.params, node.arguments)
		}

		if(!func.resolved) {
			parse.FunctionDeclaration(func)
		}

		func.numCalled++

		node.valueType = func.returType

		return node
	},

	Arguments(params, args)
	{
		for(let n = 0; n < args.length; n++) {
			const arg = args[n]
			const param = params[n]
			const valueType = parse[arg.type](arg)

			if(param.ref.valueType === ValueType.Dynamic) {
				param.ref.valueType = valueType
			}
			else if(param.valueType !== valueType) {
				logger.logError("TypeError", `invalid conversion for return value from '${ValueTypeStr[param.valueType]}' to '${ValueTypeStr[valueType]}'`)
			}
		}
	},

	ExportDefaultDeclaration(node) {
		const scopeNode = parse[node.declaration.type](node.declaration)
		return ValueType.None
	},

	XmlNode(node) {
		return node
	}
}

const parseNode = function(node) {
	return parse[node.constructor.name](node)
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

const getFromIdentifier = (node) =>
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