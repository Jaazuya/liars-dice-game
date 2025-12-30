# 📋 Guía Rápida: Dónde Colocar tus Archivos

## ✅ Archivos que ya tienes

Basado en lo que mencionaste, aquí está dónde colocar cada archivo:

### 🎲 Imágenes de Dados (PNG)
Coloca tus 6 imágenes PNG de dados en:
```
public/dice/
  ├── dice-1.png
  ├── dice-2.png
  ├── dice-3.png
  ├── dice-4.png
  ├── dice-5.png
  └── dice-6.png
```

### 🍷 Imagen del Vaso (JPG)
Coloca tu imagen del vaso en:
```
public/dice/
  └── dice_cup.jpg
```

**Nombres alternativos que también funcionan:**
- `dice_cup_diffuse.jpg`
- `dice_cup.png`
- `cup.jpg`
- `dice-cup.jpg`

El sistema intentará cargar estos nombres automáticamente.

### 🔊 Sonidos (MP3)
Coloca tus sonidos en:
```
public/sounds/
  ├── dice-shake.mp3    (sonido de barajar dados en el vaso)
  ├── bet-placed.mp3    (sonido al hacer apuesta)
  ├── liar.mp3          (sonido de acusación)
  ├── button-click.mp3  (sonido de click)
  ├── win.mp3           (sonido de victoria)
  └── lose.mp3          (sonido de derrota)
```

## 🚀 Pasos Rápidos

1. **Copia tus imágenes PNG de dados** a `public/dice/` con nombres `dice-1.png` a `dice-6.png`

2. **Copia tu imagen JPG del vaso** a `public/dice/` como `dice_cup.jpg` (o renombra el que tengas)

3. **Copia tus sonidos MP3** a `public/sounds/` con los nombres indicados arriba

4. **Reinicia el servidor** si está corriendo:
   ```bash
   npm run dev
   ```

5. **Recarga la página** y deberías ver:
   - El vaso con tu imagen
   - Los dados como imágenes PNG dentro del vaso
   - Sonidos durante las acciones del juego

## 📝 Notas

- **Si falta algún archivo**: El juego funcionará igual, usando fallbacks (emojis para dados, CSS para el vaso, sin sonidos)
- **Formatos soportados**: PNG/JPG para imágenes, MP3 para sonidos
- **Tamaños recomendados**: 
  - Dados: 128x128px o más
  - Vaso: 400x400px o más (se ajustará automáticamente)

## 🔍 Verificación

Después de agregar los archivos, verifica que:
- ✅ Los dados aparecen como imágenes (no emojis)
- ✅ El vaso muestra tu imagen (no el diseño CSS)
- ✅ Se escuchan sonidos al barajar dados
- ✅ Se escuchan sonidos al hacer acciones

¡Listo! Tu juego ahora tiene gráficos y sonidos personalizados. 🎮🎲

