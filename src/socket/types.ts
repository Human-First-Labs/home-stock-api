export interface SocketEvent {
    id: string
    name: SocketEventName
    args?: {
        [key: string]: unknown
    }
}

//These change

export type SocketEventName = 'getFullStats' | 'getUserById' | 'getItemById' | 'getFilteredItems' | 'getAllTags'