# 📦 Instrucciones para Archivos del Vaso y Dados

## Estructura de Archivos Requerida

Coloca los archivos en las siguientes ubicaciones:

### Imágenes de Dados
```
public/dice/
  ├── dice-1.png
  ├── dice-2.png
  ├── dice-3.png
  ├── dice-4.png
  ├── dice-5.png
  └── dice-6.png
```

### Imagen del Vaso
```
public/dice/
  └── dice_cup.jpg  (o dice_cup_diffuse.jpg, o cualquier nombre que tengas)
```

**Nota:** El componente busca el archivo como `/dice/dice_cup.jpg`. Si tu archivo tiene otro nombre, puedes:
1. Renombrarlo a `dice_cup.jpg`
2. O actualizar la ruta en `app/components/DiceCup.tsx` línea ~130

### Sonidos
```
public/sounds/
  ├── dice-shake.mp3  (sonido de barajar dados)
  ├── bet-placed.mp3  (sonido de apuesta)
  ├── liar.mp3        (sonido de acusación)
  ├── button-click.mp3
  ├── win.mp3
  └── lose.mp3
```

## Nombres Alternativos Aceptados

Si tus archivos tienen nombres diferentes, puedes renombrarlos o el sistema intentará cargar alternativas automáticamente.

## Verificación

Después de agregar los archivos:
1. Reinicia el servidor de desarrollo (`npm run dev`)
2. Recarga la página
3. Los dados deberían aparecer como imágenes dentro del vaso
4. Los sonidos se reproducirán automáticamente durante las acciones

## Fallback

- Si no hay imágenes de dados: se usarán emojis automáticamente
- Si no hay imagen del vaso: se usará un diseño CSS
- Si no hay sonidos: el juego funcionará sin sonidos (sin errores)

