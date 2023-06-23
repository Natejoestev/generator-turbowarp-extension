
class <%= extName %> {
  getInfo() {
    return {
      id: '<%= extId %>',
      name: '<%= extName %>',
      blocks: [
        {
          opcode: 'hello',
          blockType: Scratch.BlockType.REPORTER,
          text: 'Hello Block'
        }
      ]
    };
  }

  hello() {
    return 'World!';
  }
}

Scratch.extensions.register(new <%= extName %>());