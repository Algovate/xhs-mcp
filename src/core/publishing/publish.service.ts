import { Page } from 'puppeteer';
import { Config, PublishResult } from '../../shared/types';
import { BaseService } from '../../shared/base.service';
import { ImagePublishService } from './publish-image.service';
import { VideoPublishService } from './publish-video.service';

export class PublishService extends BaseService {
  private imageService: ImagePublishService;
  private videoService: VideoPublishService;

  constructor(config: Config) {
    super(config);
    this.imageService = new ImagePublishService(config);
    this.videoService = new VideoPublishService(config);
  }

  public async publishNote(
    title: string,
    content: string,
    imagePaths: string[],
    tags: string = '',
    browserPath?: string
  ): Promise<PublishResult> {
    return this.imageService.publishNote(title, content, imagePaths, tags, browserPath);
  }

  public async publishVideo(
    title: string,
    content: string,
    videoPath: string,
    tags: string = '',
    browserPath?: string
  ): Promise<PublishResult> {
    return this.videoService.publishVideo(title, content, videoPath, tags, browserPath);
  }

  public async publishContent(
    type: 'image' | 'video',
    title: string,
    content: string,
    mediaPaths: string[],
    tags: string = '',
    browserPath?: string
  ): Promise<PublishResult> {
    if (type === 'image') {
      return this.publishNote(title, content, mediaPaths, tags, browserPath);
    } else {
      return this.publishVideo(title, content, mediaPaths[0], tags, browserPath);
    }
  }
}
