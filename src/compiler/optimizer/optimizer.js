const AST = require("../ast")
const { ValueType } = require("../types")
const logger = require("../../logger")

let activeScope = null

const run = function(file) {
	parse.BlockDeclaration(file.blockNode)
}

const parse = 
{
	Number(node) {
		return node
	},

	String(node) {
		return node
	},

	Identifier(node) {
		return node
	},

	BlockDeclaration(node)
	{
		activeScope = node.scope

		const body = node.scope.body
		for(let n = 0; n < body.length; n++) 
		{
			const bodyNode = body[n]
			if(!bodyNode) { continue }

			body[n] = parseNode(bodyNode)
		}
	},

	Variable(node) {
		node.expr = parseNode(node.expr)
		return node
	},

	VariableDeclaration(node)
	{
		const decls = node.decls
		for(let n = 0; n < decls.length; n++) {
			const decl = decls[n]
			parseNode(decl)
		}

		return node
	},

	Expression(node)
	{
		const leftNode = parseNode(node.left)
		const rightNode = parseNode(node.right)

		if(leftNode.type === "BinaryExpression" && rightNode.simple && leftNode.right.simple) 
		{
			const leftRightNode = leftNode.right
			if(leftRightNode.type === "String") {
				leftRightNode.value += rightNode.value
				leftRightNode.raw = `"${leftRightNode.value}"`
			}
			else if(rightNode.type === "String") {
				rightNode.value = leftRightNode.value + rightNode.value
				rightNode.raw = `"${rightNode.value}"`
				leftNode.right = rightNode
			}
			else {
				leftNode.value += rightNode.value
			}
			
			return leftNode
		} 

		if(leftNode.type === "Identifier" || rightNode.type === "Identifier") {
			return node
		}

		if(rightNode.valueType === ValueType.String) {
			rightNode.value = leftNode.value + rightNode.value
			rightNode.raw = `"${rightNode.value}"`
			return rightNode
		}
		
		leftNode.value += rightNode.value
		return leftNode
	},

	AssignmentExpression(node) {
		node.right = parseNode(node.right)
		return node
	},

	BinaryExpression(node) {
		return parse.Expression(node)
	},

	FunctionExpression(node) {
		return parse.FunctionDeclaration(node)
	},

	IfStatement(node)
	{
		parse[node.test.type](node.test)
		parse.BlockDeclaration(node.consequent)
		return node
	},

	FunctionDeclaration(node) {
		parse.BlockDeclaration(node.body)
		return node
	},

	ExpressionStatement(node) {
		return parse[node.expr.constructor.name](node.expr)
	},

	ReturnStatement(node) 
	{
		if(node.arg) {
			node.arg = parse[node.arg.type](node.arg)
		}
		return node
	},

	ForStatement(node)
	{
		return node
	},
	
	CallExpression(node) {
		return node
	},

	ExportDefaultDeclaration(node) {
		return node
	},

	XmlNode(node) {
		return node
	}
}

const parseNode = (node) => {
	return parse[node.constructor.name](node)
}

module.exports = {
	run
}