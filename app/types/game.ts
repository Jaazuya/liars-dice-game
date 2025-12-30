export interface Player {
    id: string;
    name: string;
    is_host: boolean;
    dice_values: number[] | null;
    created_at: string;
    money: number;
    current_contribution: number;
    is_ready: boolean; // NUEVO
}

export interface VoteData {
    target_id: string;
    initiator_id: string;
    target_name: string;
    votes: Record<string, boolean>; // mapa de { "id_jugador": true/false }
}

export interface GameState {
    status: 'waiting' | 'boarding' | 'playing'; // NUEVO ESTADO 'boarding'
    pot: number;
    entryFee: number;
    currentTurnId: string | null;
    currentBet: {
        quantity: number;
        face: number;
    };
    voteData: VoteData | null; // NUEVO
}