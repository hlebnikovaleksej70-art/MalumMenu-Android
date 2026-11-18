import { AssemblyHelper } from "../core/AssemblyHelper";
import { BaseModule } from "../core/BaseModule";
import { Logger } from "../logger/Logger";

export class PassiveModule extends BaseModule {
    public readonly name = "Passive";

    // Классы Unity и игры
    private Screen!: Il2Cpp.Class;
    private ResolutionManager!: Il2Cpp.Class;
    private Application!: Il2Cpp.Class;
    private QualitySettings!: Il2Cpp.Class;
    
    // Специфичные классы (пример под Among Us / сессионные игры)
    private ShipStatus!: Il2Cpp.Class;
    private PlayerControl!: Il2Cpp.Class;

    // Методы
    private ResolutionManager_SetResolution!: Il2Cpp.Method;

    // Состояние
    private HasResolutionBeenChanged!: boolean;
    private OriginalWidth!: number;
    private OriginalHeight!: number;
    private isFpsShowed: boolean = false;
    private fpsDeltaTime: number = 0.0;

    public init(): void {
        this.Screen = AssemblyHelper.CoreModule.class("UnityEngine.Screen");
        this.Application = AssemblyHelper.CoreModule.class("UnityEngine.Application");
        this.QualitySettings = AssemblyHelper.CoreModule.class("UnityEngine.QualitySettings");
        
        this.ResolutionManager = AssemblyHelper.AssemblyCSharp.class("ResolutionManager");
        this.ResolutionManager_SetResolution = this.ResolutionManager.method<void>("SetResolution", 3);

        // Попытка инициализировать игровые классы (если они есть в сборке)
        try {
            this.ShipStatus = AssemblyHelper.AssemblyCSharp.class("ShipStatus");
            this.PlayerControl = AssemblyHelper.AssemblyCSharp.class("PlayerControl");
        } catch {
            Logger.debug(`[${this.name}] ShipStatus or PlayerControl not found in this assembly.`);
        }

        this.HasResolutionBeenChanged = false;
    }

    /**
     * 1. Управление разрешением (исправлено на получение максимального разрешения)
     */
    public toggleFullResolution(state: boolean): void {
        const module = this;

        if (!this.HasResolutionBeenChanged) {
            const currentRes = module.Screen.method<Il2Cpp.Object>("get_currentResolution").invoke();
            module.OriginalWidth = currentRes.method<number>("get_width").invoke();
            module.OriginalHeight = currentRes.method<number>("get_height").invoke();
            Logger.debug(`[${module.name}] Original resolution: ${module.OriginalWidth}x${module.OriginalHeight}`);
        }
        this.HasResolutionBeenChanged = true;

        if (state) {
            const resolutions = module.Screen.method<Il2Cpp.Array<Il2Cpp.Object>>("get_resolutions").invoke();
            // Берем последнее (максимальное) разрешение из массива
            const maxRes = resolutions.get(resolutions.length - 1);
            const width = maxRes.method<number>("get_width").invoke();
            const height = maxRes.method<number>("get_height").invoke();

            Logger.debug(`[${module.name}] Setting max resolution to ${width}x${height}`);
            module.ResolutionManager_SetResolution.invoke(width, height, true);
        } else {
            Logger.debug(`[${module.name}] Resetting resolution to ${module.OriginalWidth}x${module.OriginalHeight}`);
            module.ResolutionManager_SetResolution.invoke(module.OriginalWidth, module.OriginalHeight, true);
        }
    }

    /**
     * 2. Показ FPS на экране (через хук обновления или простейший отрисовщик)
     */
    public toggleFPS(enabled: boolean): void {
        this.isFpsShowed = enabled;
        if (enabled) {
            Logger.debug(`[${this.name}] FPS counter enabled.`);
            // Здесь можно запустить логику отрисовки через GUI, если игра вызывает OnGUI, 
            // либо через стандартный UnityEngine.Time.smoothDeltaTime.
        } else {
            Logger.debug(`[${this.name}] FPS counter disabled.`);
        }
    }

    /**
     * 3. Закрыть все двери (например, саботаж дверей на карте)
     */
    public closeAllDoors(): void {
        try {
            if (!this.ShipStatus) {
                Logger.error(`[${this.name}] ShipStatus class is not available.`);
                return;
            }

            // Получаем инстанс карты/корабля (ShipStatus.Instance)
            const instance = this.ShipStatus.field("Instance").value;
            if (instance && !(instance as Il2Cpp.Object).isNull()) {
                // Пример вызова закрытия дверей (зависит от конкретной версии декомпилированного кода)
                // Часто это метод вроде RpcCloseDoorsOfType или перебор зон
                Logger.debug(`[${this.name}] Executing Close All Doors...`);
                
                // Пример: вызываем метод саботажа/закрытия дверей, если он найден
                // instance.method("RpcCloseDoorsOfType").invoke(...);
            }
        } catch (e) {
            Logger.error(`[${this.name}] Failed to close doors: ${e}`);
        }
    }

    /**
     * 4. Сделать так, чтобы у всех был твой скин (подмена кастомизации)
     */
    public forceAllPlayersToMySkin(): void {
        try {
            if (!this.PlayerControl) {
                Logger.error(`[${this.name}] PlayerControl class is not available.`);
                return;
            }

            // Находим локального игрока (LocalPlayer)
            const localPlayer = this.PlayerControl.field("LocalPlayer").value;
            if (!localPlayer || (localPlayer as Il2Cpp.Object).isNull()) {
                Logger.debug(`[${this.name}] LocalPlayer not found yet (are you in a game?).`);
                return;
            }

            // Получаем данные скина/костюма локального игрока (например, поле outfit или get_CurrentOutfit)
            // И применяем их ко всем остальным игрокам в списке AllPlayerControls
            Logger.debug(`[${this.name}] Forcing local player skin to all clients...`);
            
            const allPlayers = this.PlayerControl.field("AllPlayerControls").value;
            // Здесь можно пройти по списку игроков и вызвать метод установки кастомизации (SetSkin / SetOutfit)
        } catch (e) {
            Logger.error(`[${this.name}] Failed to sync skins: ${e}`);
        }
    }
}
