
function camelCase(string) 
{
    return string.replace(/-([a-z])/ig, (all, letter) => {
        return letter.toUpperCase();
    });
}

module.exports = {
	camelCase
};
