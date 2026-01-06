export interface Player {
    id: string;
    user_id?: string; // ID de autenticación (Supabase Auth)
    name: string;
    is_host: boolean;
    dice_values: number[] | null;
    created_at?: string;
    is_ready: boolean; // NUEVO
    seat_index: number | null; // Índice de asiento aleatorio
    has_used_cheat?: boolean; // Truco usado (1 vez por partida)
}

export interface DiceGameOverEntry {
    user_id?: string;
    username: string;
    rank: number; // 1..3
    payout: number;
    score?: number;
}

export interface VoteData {
    target_id: string;
    initiator_id: string;
    target_name: string;
    votes: Record<string, boolean>; // mapa de { "id_jugador": true/false }
}

export interface NotificationData {
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    loserId: string;
    timestamp: number;
}

export interface GameOverData {
    winner: string;
    winnerName: string;
    runnerUp: string | null;
    runnerUpName: string | null;
    third: string | null;
    thirdName: string | null;
    amounts: {
        winner: number;
        runnerUp: number;
        third?: number;
    };
    losers: string[];
    totalPot: number;
}

export interface GameState {
    status: 'waiting' | 'boarding' | 'playing' | 'finished' | 'not_found'; // NUEVO ESTADO 'finished'
    pot: number;
    entryFee: number;
    currentTurnId: string | null;
    lastBetUserId: string | null; // dice_rooms.last_bet_player_id (auth.user.id)
    currentBet: {
        quantity: number;
        face: number;
    };
    voteData: VoteData | null; // NUEVO
    notificationData: NotificationData | null; // Notificación global sincronizada
    gameOverData: DiceGameOverEntry[] | null; // Datos de fin de juego (backend)
    allowCheats: boolean; // Si la sala permite trucos
    randomTurns: boolean; // Si los turnos son aleatorios
    turnSequence: string[] | null; // Orden de turnos cuando randomTurns está activo
}