const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

const app = express();
const PORT = 3000;

const upload = multer({ dest: 'uploads/' });

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
  res.render('index');
});

app.get('/coord-finder', (req, res) => {
  res.render('coord-finder'); // ou res.sendFile se for html puro
});


app.post('/gerar', upload.fields([
  { name: 'pdf', maxCount: 1 },
  { name: 'paises', maxCount: 1 }
]), async (req, res) => {
  const { campos, fonte, tamanho, cor } = req.body;
  const pdfPath = req.files.pdf[0].path;
  const paisesPath = req.files.paises[0].path;

  const camposMap = {};
  campos.split('\n').forEach(linha => {
    const [campo, coord] = linha.trim().split('=');
    if (campo && coord) {
      const [x, y] = coord.split(',').map(n => parseInt(n.trim()));
      camposMap[campo.trim()] = { x, y };
    }
  });

  const paises = fs.readFileSync(paisesPath, 'utf-8')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(linha => {
      const campos = linha.split(';').map(c => c.trim());
      const obj = {};
      Object.keys(camposMap).forEach((key, i) => {
        obj[key] = campos[i] || '';
      });
      return obj;
    });

  const pdfBytesBase = fs.readFileSync(pdfPath);
  const baseDoc = await PDFDocument.load(pdfBytesBase);
  const finalDoc = await PDFDocument.create();

  const fontesDisponiveis = {
    Helvetica: StandardFonts.Helvetica,
    TimesRoman: StandardFonts.TimesRoman,
    Courier: StandardFonts.Courier
  };

  const font = await finalDoc.embedFont(fontesDisponiveis[fonte] || StandardFonts.Helvetica);
  const fontSize = parseInt(tamanho) || 15;
  const corRgb = hexToRgb(cor || '#000000');

  for (const item of paises) {
    const tempDoc = await PDFDocument.load(pdfBytesBase);
    const [copiedPage] = await finalDoc.copyPages(tempDoc, [0]);
    finalDoc.addPage(copiedPage);

    for (const campo in camposMap) {
      const { x, y } = camposMap[campo];
      copiedPage.drawText(item[campo], {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(corRgb.r / 255, corRgb.g / 255, corRgb.b / 255),
      });
    }
  }

  const finalPdfBytes = await finalDoc.save();
  const finalPath = path.join(__dirname, 'paises_final.pdf');
  fs.writeFileSync(finalPath, finalPdfBytes);

  res.download(finalPath, 'paises_final.pdf', () => {
    fs.unlinkSync(pdfPath);
    fs.unlinkSync(paisesPath);
    fs.unlinkSync(finalPath);
  });
});

function hexToRgb(hex) {
  const parsed = hex.replace('#', '').match(/.{1,2}/g);
  const [r, g, b] = parsed.map(v => parseInt(v, 16));
  return { r, g, b };
}

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
