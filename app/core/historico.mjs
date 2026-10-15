// Desfazer/refazer por instantâneos da lista de objetos (projetos são pequenos).
export class Historico {
  constructor(limite = 300) { this.desfazerPilha = []; this.refazerPilha = []; this.limite = limite; }
  instantaneo(doc) { return JSON.stringify(doc.objetos); }
  registrar(doc) { this.registrarTexto(this.instantaneo(doc)); }
  registrarTexto(txt) {
    this.desfazerPilha.push(txt);
    if (this.desfazerPilha.length > this.limite) this.desfazerPilha.shift();
    // malhas grandes: limita a memória do desfazer a ~300 MB
    let total = this.desfazerPilha.reduce((s, x) => s + x.length, 0);
    while (total > 3e8 && this.desfazerPilha.length > 1) total -= this.desfazerPilha.shift().length;
    this.refazerPilha = [];
  }
  desfazer(doc) {
    if (!this.desfazerPilha.length) return false;
    this.refazerPilha.push(this.instantaneo(doc));
    doc.objetos = JSON.parse(this.desfazerPilha.pop());
    return true;
  }
  refazer(doc) {
    if (!this.refazerPilha.length) return false;
    this.desfazerPilha.push(this.instantaneo(doc));
    doc.objetos = JSON.parse(this.refazerPilha.pop());
    return true;
  }
  limpar() { this.desfazerPilha = []; this.refazerPilha = []; }
}
