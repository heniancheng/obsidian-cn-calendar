import {TAbstractFile} from 'obsidian';
import {NoteType, TemplatePlugin} from "../base/enum";
import Path from "../util/Path";
import PathUtil from "../util/PathUtil";
import DustCalendarPlugin from "../main";
import TemplateUtil from "../util/TemplateUtil";
import ObsidianTemplateUtil from "../util/ObsidianTemplateUtil";
import TemplaterUtil from "../util/TemplaterUtil";


/**
 * 封装模板操作
 */
export default class TemplateController {

    public readonly plugin: DustCalendarPlugin;
    public templateUtil: TemplateUtil;

    constructor(plugin: DustCalendarPlugin) {
        this.plugin = plugin;
        this.templateUtil = new TemplateUtil(this.plugin);
    }

    public getTemplatePlugin(): TemplatePlugin {
        return this.plugin.database.setting.templatePlugin;
    }

    public isTemplatePluginEnable(): boolean {
        return this.templateUtil.isEnable();
    }

    public updateTemplatePlugin(templatePlugin: TemplatePlugin): void {
        this.plugin.database.setting.templatePlugin = templatePlugin;
        if (templatePlugin === TemplatePlugin.OBSIDIAN) {
            this.templateUtil = new ObsidianTemplateUtil(this.plugin);
        }
        else if (templatePlugin === TemplatePlugin.TEMPLATER) {
            this.templateUtil = new TemplaterUtil(this.plugin);
        }
        else {
            this.templateUtil = new TemplateUtil(this.plugin);
        }
    }

    public hasTemplateFolder(): boolean {
        const folder = this.templateUtil.getTemplateFolder();
        return folder.string.length !== 0 && PathUtil.exists(folder, this.plugin.app.vault);
    }

    public getTemplateFolder(): Path {
        return this.templateUtil.getTemplateFolder();
    }

    public getTemplateFilename(noteType: NoteType): string | null {

        if (this.plugin.database.setting.templatePlugin === TemplatePlugin.NONE) {
            return null;
        }

        if (noteType === NoteType.DAILY) {
            return this.plugin.database.setting.dailyTemplateFilename;
        }
        else if (noteType === NoteType.WEEKLY) {
            return this.plugin.database.setting.weeklyTemplateFilename;
        }
        else if (noteType === NoteType.MONTHLY) {
            return this.plugin.database.setting.monthlyTemplateFilename;
        }
        else if (noteType === NoteType.QUARTERLY) {
            return this.plugin.database.setting.quarterlyTemplateFilename;
        }
        else if (noteType === NoteType.YEARLY) {
            return this.plugin.database.setting.yearlyTemplateFilename;
        }

        return null;
    }

    public setTemplateFilename(noteType: NoteType, templateFilename: string): void {
        if (this.plugin.database.setting.templatePlugin === TemplatePlugin.NONE) {
            return;
        }

        if (noteType === NoteType.DAILY) {
            this.plugin.database.setting.dailyTemplateFilename = templateFilename;
        }
        else if (noteType === NoteType.WEEKLY) {
            this.plugin.database.setting.weeklyTemplateFilename = templateFilename;
        }
        else if (noteType === NoteType.MONTHLY) {
            this.plugin.database.setting.monthlyTemplateFilename = templateFilename;
        }
        else if (noteType === NoteType.QUARTERLY) {
            this.plugin.database.setting.quarterlyTemplateFilename = templateFilename;
        }
        else if (noteType === NoteType.YEARLY) {
            this.plugin.database.setting.yearlyTemplateFilename = templateFilename;
        }
    }

    public hasTemplateFile(filename: string): boolean {
        return this.getTemplateFileByFilename(filename) !== null;
    }

    public insertTemplate(noteType: NoteType) {

        if (!this.templateUtil.isEnable()) {
            return;
        }

        const templateFile = this.getTemplateFileByNoteType(noteType);
        if (templateFile === null) {
            return;
        }

        this.notify(this, templateFile, 0);
    }

    public notify(templateController: TemplateController, templateFile: TAbstractFile, retryCount: number = 0) {
        const MAX_RETRIES = 30; // 最大重试次数，例如 30 * 100ms = 3 秒
        const DELAY_MS = 100;   // 每次重试的延迟（毫秒）
        if (retryCount >= MAX_RETRIES) {
            console.error("TemplateController Plugin: 超过最大重试次数，无法插入模板，没有活动编辑器或编辑器未准备好。", templateFile.path);
            return;
        }
        const activeLeaf = this.plugin.app.workspace.activeLeaf;
        const activeEditor = this.plugin.app.workspace.activeEditor;
        // 检查是否有活动工作区叶子，并且它是 Markdown 视图，同时有活动编辑器
        if (activeLeaf && activeLeaf.view.getViewType() === "markdown" && activeEditor) {
            // 编辑器似乎已经准备好，但为了确保 Templater 也有足够的时间进行其内部检查，
            // 额外增加一个小的延迟。
            setTimeout(() => {
                this.insertTemplateImpl(templateFile);
            }, 50); 
        } else {
            // 如果编辑器尚未准备好，则在 DELAY_MS 后重试
            setTimeout(() => templateController.notify(templateController,templateFile, retryCount + 1), DELAY_MS);
        }
    }

    // 真正执行模板插入的函数
    public insertTemplateImpl(templateFile: TAbstractFile) {
        this.templateUtil.insertTemplateImpl(templateFile);
    }

    public getTemplateFileByFilename(filename: string): TAbstractFile | null {
        const folder = this.getTemplateFolder();
        if (folder.string.length === 0 || !PathUtil.exists(folder, this.plugin.app.vault)) {
            return null;
        }

        return this.getTemplateFileImpl(folder, new Path(filename));
    }

    private getTemplateFileByNoteType(noteType: NoteType): TAbstractFile | null {

        const folder = this.getTemplateFolder();
        if (folder.string.length === 0 || !PathUtil.exists(folder, this.plugin.app.vault)) {
            return null;
        }

        const {setting} = this.plugin.database;
        if (noteType === NoteType.DAILY) {
            return this.getTemplateFileImpl(folder, new Path(setting.dailyTemplateFilename));
        }
        else if (noteType === NoteType.WEEKLY) {
            return this.getTemplateFileImpl(folder, new Path(setting.weeklyTemplateFilename));
        }
        else if (noteType === NoteType.MONTHLY) {
            return this.getTemplateFileImpl(folder, new Path(setting.monthlyTemplateFilename));
        }
        else if (noteType === NoteType.QUARTERLY) {
            return this.getTemplateFileImpl(folder, new Path(setting.quarterlyTemplateFilename));
        }
        else if (noteType === NoteType.YEARLY) {
            return this.getTemplateFileImpl(folder, new Path(setting.yearlyTemplateFilename));
        }

        return null;
    }

    private getTemplateFileImpl(folder: Path, pureFilename: Path): TAbstractFile | null {
        // 补全文件后缀名
        let newFilenameStr = pureFilename.string;
        if (pureFilename.extension.string.length === 0) {
            newFilenameStr = newFilenameStr.concat(".md");
        }
        let newFilename = new Path(newFilenameStr);

        const fullPath = folder.append(newFilename);
        return this.plugin.app.vault.getAbstractFileByPath(fullPath.string)
    }
}
