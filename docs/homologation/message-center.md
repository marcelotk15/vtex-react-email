# Procedimento manual no Message Center

Esta verificação é manual. Não há script de envio, nem leitura de credencial, nem gravação automática na conta.

O artefato a colar é o HTML com Handlebars produzido por `vtex-email build`. Não colar o preview resolvido (`vtex-email preview` grava HTML já avaliado e não serve como template). Não colar fixture dentro do template.

## Passos

1. Compilar o email na máquina local, no Node `24.21.0`, com `pnpm typecheck`, `pnpm test` e `pnpm proof` verdes, ou com `vtex-email build` no projeto consumidor.
2. Abrir o arquivo de artefato, por exemplo `dist/order-confirmed.html` ou `proof/out/with space/order-confirmed.html`. Confirmar que os dados da fixture (`ORD-A`, `200,00`, nomes) não estão congelados no arquivo.
3. No Message Center da conta de teste, abrir o template transacional correspondente e colar o conteúdo no campo de template. Não publicar e não criar campanha.
4. No painel de teste da própria conta, usar o JSON do caso. O JSON é sintético. Ele não é o envelope confirmado do evento VTEX.
5. Ler o HTML e o texto resolvidos. Comparar com o resultado local esperado do caso, no trecho indicado.
6. Se a conta oferecer salvar rascunho, isso não entra neste procedimento. Encerrar sem enviar mensagem a destinatário.

## O que esta etapa prova

Somente a avaliação daquele template com aquele JSON naquela conta, na data registrada. Não prova o cliente de email, nem a visualização do `vtex-email dev`, nem as demais capacidades do perfil.

Uma divergência fica no registro do caso. A capacidade permanece no estado atual (`documented` ou `experimental`) até o registro de aprovação específico. Um caso positivo não homologa o perfil inteiro.
