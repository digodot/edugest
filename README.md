# EduGestão — Painel do Professor

## 1. Requisitos
- Node.js 18+
- PostgreSQL 14+

## 2. Banco local
Crie um banco chamado `edugestao` no PostgreSQL.
Depois copie `.env.example` para `.env` e ajuste `DATABASE_URL`.

Exemplo:
`postgresql://postgres:SENHA@localhost:5432/edugestao`

## 3. Instalação
```bash
npm install
npm start
```
Acesse: http://localhost:3000

As tabelas são criadas automaticamente na primeira execução.

## 4. Importação Excel
A primeira aba da planilha é lida no navegador com SheetJS.
Colunas reconhecidas:
- nome / nome completo / aluno / estudante
- email / e-mail
- escola / unidade
- turma / classe
- matricula / matrícula / RA / registro

Linhas sem nome são ignoradas. A API evita duplicação por email + escola + turma quando o email estiver preenchido.

## 5. Publicação online
Suba o projeto para um serviço que execute Node.js e configure:
- `DATABASE_URL` = URL do PostgreSQL hospedado
- `NODE_ENV=production`
- `PORT` = porta fornecida pelo serviço

Não coloque credenciais SQL no HTML/JavaScript.


## 6. Trabalhos em grupo
A aplicação possui um módulo para:
- criar um trabalho vinculado a uma turma;
- definir a quantidade de grupos;
- distribuir os alunos automaticamente;
- mover alunos entre grupos manualmente;
- salvar a composição dos grupos no PostgreSQL;
- registrar avaliação por grupo;
- registrar nota geral e notas por critério (conteúdo, equipe e apresentação).

A estrutura permite posteriormente acrescentar avaliação individual dentro de um mesmo grupo sem alterar a organização principal.
