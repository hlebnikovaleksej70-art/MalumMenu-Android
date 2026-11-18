import { AssemblyHelper } from "../core/AssemblyHelper";
import { BaseModule } from "../core/BaseModule";
import { Logger } from "../logger/Logger";

export class PassiveModule extends BaseModule {
    public readonly name = "Passive";

    // Classes
    private Screen!: Il2Cpp.Class;
    private ResolutionManager!: Il2Cpp.Class;
    private DataManager!: Il2Cpp.Class;
    private SettingsData!: Il2Cpp.Class;

    // Methods
    private ResolutionManager_SetResolution!: Il2Cpp.Method;
    private SettingsData_get_ChatMode!: Il2Cpp.Method;

    private HasResolutionBeenChanged!: boolean;
    private OriginalWidth!: number;
    private OriginalHeight!: number;
    private ForceFreeChat: boolean = false;

    public init(): void {
        this.Screen = AssemblyHelper.CoreModule.class("UnityEngine.Screen");
        this.ResolutionManager = AssemblyHelper.AssemblyCSharp.class("ResolutionManager");
        this.ResolutionManager_SetResolution = this.ResolutionManager.method<void>("SetResolution", 3);

        // Инициализация классов настроек чата
        this.DataManager = AssemblyHelper.AssemblyCSharp.class("AmongUs.Data.DataManager");
        this.SettingsData = AssemblyHelper.AssemblyCSharp.class("AmongUs.Data.Settings.SettingsData");
        this.SettingsData_get_ChatMode = this.SettingsData.method("get_ChatMode");

        this.HasResolutionBeenChanged = false;

        // Перехват метода получения режима чата (1 = FreeChatOrQuickChat)
        const module = this;
        this.SettingsData_get_ChatMode.implementation = function (): any {
            if (module.ForceFreeChat) {
                return 1;
            }
            return this.method("get_ChatMode").invoke();
        };
    }

    public toggleFreeChat(state: boolean): void {
        this.ForceFreeChat = state;
        Logger.debug(`[${this.name}::ToggleFreeChat] ForceFreeChat set to: ${state}`);
    }

    public toggleFullResolution(state: boolean): void {
        const module = this;

        if (!this.HasResolutionBeenChanged) {
            const original_resolution = module.Screen.method<Il2Cpp.Object>("get_currentResolution").invoke();
            module.OriginalWidth = original_resolution.method<number>("get_width").invoke();
            module.OriginalHeight = original_resolution.method<number>("get_height").invoke();
            Logger.debug(`[${module.name}::ToggleFullResolution] Original resolution: ${module.OriginalWidth}x${module.OriginalHeight}`);
        }
        this.HasResolutionBeenChanged = true;

        if (state) {
            const resolutions = module.Screen.method<Il2Cpp.Array<Il2Cpp.Object>>("get_resolutions").invoke();
            const width = resolutions.get(0).method<number>("get_width").invoke();
            const height = resolutions.get(0).method<number>("get_height").invoke();

            Logger.debug(`[${module.name}::ToggleFullResolution] Setting resolution to ${height}x${width}`);
            module.ResolutionManager_SetResolution.invoke(height, width, true);
        } else {
            Logger.debug(`[${module.name}::ToggleFullResolution] Resetting resolution to ${module.OriginalWidth!}x${module.OriginalHeight!}`);
            module.ResolutionManager_SetResolution.invoke(module.OriginalWidth, module.OriginalHeight, true);
        }
    }
}
