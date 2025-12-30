# Sistema de Notificaciones - Documentación Técnica

## Resumen

El juego implementa un sistema de notificaciones de dos niveles:
1. **GameNotification**: Notificaciones pequeñas para mensajes informativos y errores
2. **RoundResult**: Anuncios grandes para resultados de ronda con callback de continuación

## Arquitectura

### 1. Sistema de Callbacks en `useLiarGame`

El hook `useLiarGame` recibe dos callbacks opcionales:

```typescript
export const useLiarGame = (
    code: string, 
    onNotification?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void,
    onRoundResult?: (message: string, type?: 'success' | 'error' | 'info' | 'warning', onClose?: () => void) => void
)
```

- **`onNotification`**: Para notificaciones simples que se muestran y desaparecen automáticamente
- **`onRoundResult`**: Para anuncios grandes de resultados que pueden incluir un callback que se ejecuta cuando se cierra

### 2. Componentes de Notificación

#### A. GameNotification (`app/components/GameNotification.tsx`)

**Propósito**: Notificaciones pequeñas en la parte superior de la pantalla

**Características**:
- Duración: 4 segundos (configurable)
- Posición: Parte superior central
- Auto-cierre: Sí, automático después del delay
- Cierre manual: Botón "×" disponible
- Estilos: Temática Western con textura de papel y clavos decorativos

**Tipos soportados**:
- `success`: Verde (✅)
- `error`: Rojo (❌)
- `warning`: Naranja (⚠️)
- `info`: Azul (ℹ️)

**Código del componente**:
```typescript
export const GameNotification = ({ 
  message, 
  type = 'info', 
  onClose, 
  duration = 4000 
}: GameNotificationProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);
  
  // ... renderizado con animaciones Framer Motion
}
```

#### B. RoundResult (`app/components/RoundResult.tsx`)

**Propósito**: Anuncios grandes de resultados de ronda que bloquean la pantalla

**Características**:
- Duración: 5 segundos (configurable)
- Posición: Centro de la pantalla con overlay oscuro
- Auto-cierre: Sí, automático después del delay
- Cierre manual: Click en cualquier parte del overlay
- Estilos: Temática Western con gradientes, textura de papel y clavos decorativos
- Tamaño: Responsive, más grande que GameNotification

**Código del componente**:
```typescript
export const RoundResult = ({ 
  message, 
  type = 'info', 
  onClose, 
  autoCloseDelay = 5000 
}: RoundResultProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, autoCloseDelay);
    return () => clearTimeout(timer);
  }, [onClose, autoCloseDelay]);
  
  // ... renderizado con animaciones Framer Motion
}
```

### 3. Integración en `page.tsx`

#### Estado Local

```typescript
const [notification, setNotification] = useState<{ 
  message: string; 
  type?: 'success' | 'error' | 'info' | 'warning' 
} | null>(null);

const [roundResult, setRoundResult] = useState<{ 
  message: string; 
  type?: 'success' | 'error' | 'info' | 'warning' 
} | null>(null);

const roundResultCallbackRef = useRef<(() => void) | null>(null);
```

#### Configuración de Callbacks

```typescript
const { players, myId, gameState, getDiceEmoji, actions } = useLiarGame(
  code as string,
  // Callback para notificaciones simples
  (message, type) => setNotification({ message, type }),
  // Callback para resultados de ronda con callback de continuación
  (message, type, onCloseCallback) => {
    setRoundResult({ message, type });
    if (onCloseCallback) {
      roundResultCallbackRef.current = onCloseCallback;
    }
  }
);
```

#### Renderizado de Componentes

```typescript
{/* NOTIFICACIONES DEL JUEGO */}
<AnimatePresence>
  {notification && (
    <GameNotification
      message={notification.message}
      type={notification.type}
      onClose={() => setNotification(null)}
    />
  )}
</AnimatePresence>

{/* RESULTADO DE RONDA (Anuncio Grande) */}
<AnimatePresence>
  {roundResult && (
    <RoundResult
      message={roundResult.message}
      type={roundResult.type}
      onClose={() => {
        setRoundResult(null);
        // Ejecutar el callback de barajeo cuando se cierra el anuncio
        if (roundResultCallbackRef.current) {
          const callback = roundResultCallbackRef.current;
          roundResultCallbackRef.current = null;
          callback();
        }
      }}
    />
  )}
</AnimatePresence>
```

## Flujo de Uso

### Caso 1: Notificación Simple (GameNotification)

**Ejemplo**: Error de validación en apuesta

```typescript
// En useLiarGame.ts
const placeBet = async (qty: number, face: number) => {
  if (qty <= currentBet.quantity) {
    onNotification?.(`Debes aumentar la cantidad...`, 'error');
    return;
  }
  // ... resto de la lógica
};
```

**Flujo**:
1. `onNotification` se llama con mensaje y tipo
2. `setNotification` actualiza el estado en `page.tsx`
3. `GameNotification` se renderiza automáticamente
4. Después de 4 segundos, se cierra automáticamente
5. `setNotification(null)` limpia el estado

### Caso 2: Resultado de Ronda (RoundResult con Callback)

**Ejemplo**: Resolución de ronda después de "Mentiroso" o "Exacto"

```typescript
// En useLiarGame.ts - resolveRound
const resolveRound = async (action: 'LIAR' | 'EXACT') => {
  // ... cálculo de perdedor ...
  
  if (survivors.length === 1) {
    // Caso ganador
    onRoundResult?.(`🏆 ¡GANADOR: ${winner.name}!...`, 'success');
    onNotification?.(`🏆 ¡GANADOR: ${winner.name}!...`, 'success');
  } else {
    // Caso continuación de ronda
    const notificationType = message.includes('❌') ? 'error' : 'success';
    
    onRoundResult?.(message, notificationType, async () => {
      // Este callback se ejecuta cuando RoundResult se cierra (después de 5 segundos)
      
      // RE-BARAJEAR DADOS para todos los sobrevivientes
      const reShuffleUpdates = finalSurvivors.map(p => {
        const currentDiceCount = p.dice_values?.length || 5;
        const newDice = Array.from({ length: currentDiceCount }, () => 
          Math.floor(Math.random() * 6) + 1
        );
        return supabase
          .from('players')
          .update({ dice_values: newDice })
          .eq('id', p.id);
      });
      await Promise.all(reShuffleUpdates);

      // Reiniciar apuesta y pasar turno
      await supabase
        .from('rooms')
        .update({ 
          current_bet_quantity: 0, 
          current_bet_face: 0,
          current_turn_player_id: nextTurnPlayer.id 
        })
        .eq('code', code);
    });
  }
};
```

**Flujo**:
1. `onRoundResult` se llama con mensaje, tipo y callback
2. `setRoundResult` actualiza el estado en `page.tsx`
3. El callback se guarda en `roundResultCallbackRef.current`
4. `RoundResult` se renderiza y bloquea la pantalla
5. Después de 5 segundos, `RoundResult` se cierra automáticamente
6. El `onClose` de `RoundResult` ejecuta el callback guardado
7. El callback barajea los dados y reinicia la apuesta
8. `setRoundResult(null)` limpia el estado

## Ventajas del Sistema Actual

✅ **Separación de responsabilidades**: Notificaciones simples vs. anuncios importantes
✅ **Callbacks asíncronos**: Permite ejecutar lógica después de mostrar el resultado
✅ **Timing controlado**: 5 segundos para leer el resultado antes de continuar
✅ **UX mejorada**: Los dados no se barajean hasta que el usuario ve el resultado
✅ **Temática consistente**: Ambos componentes siguen el estilo Western del juego

## Casos de Uso Documentados

### 1. Error de Validación de Apuesta
- **Componente**: `GameNotification`
- **Tipo**: `error`
- **Duración**: 4 segundos
- **Ubicación**: `useLiarGame.ts` → `placeBet`

### 2. Resultado de Ronda (Continuación)
- **Componente**: `RoundResult`
- **Tipo**: `error` o `success` según resultado
- **Duración**: 5 segundos
- **Callback**: Barajeo de dados y reinicio de apuesta
- **Ubicación**: `useLiarGame.ts` → `resolveRound`

### 3. Ganador del Juego
- **Componente**: `RoundResult` + `GameNotification`
- **Tipo**: `success`
- **Duración**: 5 segundos (RoundResult), 4 segundos (GameNotification)
- **Ubicación**: `useLiarGame.ts` → `resolveRound` (caso ganador)

## Estructura de Archivos

```
app/
├── components/
│   ├── GameNotification.tsx    # Notificaciones pequeñas
│   └── RoundResult.tsx          # Anuncios grandes de resultados
├── hooks/
│   └── useLiarGame.ts           # Lógica del juego y llamadas a callbacks
└── room/[code]/
    └── page.tsx                 # Integración de componentes y estado
```

## Notas Técnicas

- **Framer Motion**: Ambos componentes usan `AnimatePresence` y `motion` para animaciones suaves
- **Responsive**: Ambos componentes son adaptativos para móviles y desktop
- **Z-index**: 
  - `GameNotification`: `z-[200]`
  - `RoundResult`: `z-[300]`
- **Estado local**: Las notificaciones se manejan con `useState` en `page.tsx`, no se sincronizan entre jugadores
- **Callbacks opcionales**: Los callbacks pueden ser `undefined`, por lo que se usa el operador `?.` para llamadas seguras
