# 🎵 Guía de Sonidos para el Juego de Dado Mentiroso

Este documento explica cómo agregar sonidos reales a tu juego.

## 📁 Estructura de Archivos

Crea una carpeta `public/sounds/` en la raíz del proyecto y coloca allí tus archivos de sonido:

```
red-dead-dice/
  public/
    sounds/
      dice-shake.mp3
      bet-placed.mp3
      liar.mp3
      button-click.mp3
      win.mp3
      lose.mp3
```

## 🎲 Sonidos Necesarios

### 1. **dice-shake.mp3** - Barajar Dados
- **Cuándo se reproduce**: Cuando se barajan los dados al inicio de una ronda
- **Duración recomendada**: 1-2 segundos
- **Tipo**: Sonido de vaso/recipiente con dados siendo agitados
- **Ejemplos**: Busca "dice shake", "dice cup", "shaking dice" en sitios de sonidos libres

### 2. **bet-placed.mp3** - Apuesta Realizada
- **Cuándo se reproduce**: Cuando un jugador hace una apuesta
- **Duración recomendada**: 0.5-1 segundo
- **Tipo**: Sonido de confirmación, como una moneda cayendo o un "click" satisfactorio
- **Ejemplos**: "coin drop", "cash register", "button confirm"

### 3. **liar.mp3** - Acusación de Mentiroso
- **Cuándo se reproduce**: Cuando se presiona el botón "¡MENTIROSO!"
- **Duración recomendada**: 1-2 segundos
- **Tipo**: Sonido dramático, como un grito o un sonido de tensión
- **Ejemplos**: "dramatic sting", "suspense", "western duel"

### 4. **button-click.mp3** - Click de Botón
- **Cuándo se reproduce**: Al hacer click en botones del juego
- **Duración recomendada**: 0.2-0.5 segundos
- **Tipo**: Sonido suave de click o tap
- **Ejemplos**: "ui click", "button tap", "soft click"

### 5. **win.mp3** - Victoria
- **Cuándo se reproduce**: Cuando un jugador gana la ronda
- **Duración recomendada**: 2-3 segundos
- **Tipo**: Sonido de celebración o victoria
- **Ejemplos**: "victory fanfare", "win sound", "celebration"

### 6. **lose.mp3** - Derrota
- **Cuándo se reproduce**: Cuando un jugador pierde un dado
- **Duración recomendada**: 1-2 segundos
- **Tipo**: Sonido de derrota o error
- **Ejemplos**: "lose sound", "error", "negative feedback"

## 🌐 Recursos para Descargar Sonidos Gratis

1. **Freesound.org** (https://freesound.org)
   - Requiere cuenta gratuita
   - Licencias Creative Commons
   - Gran variedad de sonidos

2. **Zapsplat** (https://www.zapsplat.com)
   - Requiere cuenta gratuita
   - Sonidos de alta calidad
   - Licencia comercial disponible

3. **OpenGameArt** (https://opengameart.org)
   - Sonidos libres para juegos
   - Varias licencias disponibles

4. **Mixkit** (https://mixkit.co/free-sound-effects/)
   - Sonidos gratuitos sin registro
   - Licencia libre de regalías

## 🔧 Configuración

Los sonidos están configurados en `app/hooks/useGameSounds.ts`. Si quieres cambiar las rutas o agregar más sonidos, edita ese archivo.

## ⚙️ Desactivar Sonidos

Si quieres desactivar los sonidos temporalmente, puedes modificar el hook:

```typescript
const sounds = useGameSounds(false); // false = sin sonidos
```

O simplemente no agregues los archivos de sonido y el juego funcionará normalmente sin errores.

## 📝 Notas

- Los archivos deben estar en formato MP3, WAV u OGG
- Si un archivo no existe, el juego funcionará normalmente sin reproducir ese sonido
- Los volúmenes están preconfigurados, pero puedes ajustarlos en `useGameSounds.ts`

