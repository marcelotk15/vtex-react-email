# Matriz visual

Esta matriz observa layout. Não observa a semântica de `formatCurrency`, `replace`, `eq` ou `../`. Isso pertence aos casos do Message Center.

Três camadas, cada uma com o próprio registro:

- Visualização no navegador: `vtex-email dev`. Desktop é a largura 600 px. Mobile é a largura 375 px. Não é um aplicativo de email.
- Execução no Message Center: HTML resolvido pela conta, ainda sem cliente.
- Renderização em cliente real: a mensagem vista no cliente abaixo. O bloqueio de imagens desta linha é o bloqueio do próprio cliente. O controle “Bloquear imagens remotas” do preview só evita requisição na cópia do iframe e não conta aqui.

## Clientes

- Gmail, com a superfície registrada (web ou aplicativo).
- Apple Mail, com o sistema registrado (macOS ou iOS).
- Outlook na web.
- Outlook clássico no Windows.

Não substituir Outlook clássico por Outlook na web.

## Cenários

- Vários itens: a fixture de entrega da prova, com dois pedidos e três itens.
- Texto longo: um nome ou uma rua sintéticos longos o bastante para quebrar a largura.
- Dado opcional ausente: a fixture de retirada, sem endereço.
- Imagens bloqueadas pelo cliente.
- Idiomas suportados pelo exemplo: `pt-BR` e `en-US`.

## Critério

Cada célula precisa do molde em [registro.md](registro.md), com cliente, versão e data. Célula sem execução permanece pendente. Um cliente aprovado não aprova os outros. Um idioma aprovado não aprova o outro.
