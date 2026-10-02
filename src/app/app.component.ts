import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast } from 'primeng/toast';
import { SceneComponent } from '@shared/components/scene/scene.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Toast, SceneComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'Pokédex';
}
