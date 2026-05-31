# 🌌 IMGCHEST UPLOADER

Une application de bureau moderne, ultra-rapide et de haute fidélité pour le téléversement par lots d'images sur **ImgChest**. Conçue avec un backend Python robuste (`PyWebView` & `requests`) et une interface graphique de pointe en **React + TypeScript + Vite** au design sombre et vitreux (glassmorphism).

---

## 🎨 Fonctionnalités

- **⚡ Téléversement par Lots Rapide** : Téléversez automatiquement des dizaines d'images, regroupées en lots optimisés de 19 images.
- **🛠️ Interface Glassmorphic Interactive** :
  - Tri et réorganisation des images avant l'envoi via des boutons haut/bas.
  - Zoom interactif et fluide en cliquant sur les miniatures avec molette ou curseur.
  - Journal de console détaillé intégré en temps réel.
  - Barre de progression animée.
- **🔑 Gestion Dynamique des Clés API** : Configurez et sauvegardez de manière permanente votre clé API ImgChest directement depuis l'interface utilisateur. Vos clés sont chiffrées/sauvegardées localement dans `config.json`.
- **🔗 Partage Simplifié** : Récupérez en un clic le lien de l'album unifié ou copiez l'ensemble des liens individuels des images hébergées.
- **🐧 Multi-plateforme (Windows, macOS, Linux)** : Se lance de manière fluide sur n'importe quel système d'exploitation.

---

## 🚀 Installation & Lancement

### Prérequis
Assurez-vous d'avoir installé **Python 3** (et optionnellement Node.js si vous souhaitez modifier l'interface frontend).

1. Clonez ou téléchargez ce projet dans un dossier de votre machine.
2. Installez les dépendances requises :
   ```bash
   pip install -r requirements.txt
   ```

### Lancement de l'Application

#### 💻 Sur Windows
Double-cliquez simplement sur le fichier de script batch :
```bash
run.bat
```

#### 🍎 Sur macOS & 🐧 Sur Linux
Ouvrez votre terminal dans le dossier du projet, rendez le script d'exécution exécutable et lancez-le :
```bash
chmod +x run.sh
./run.sh
```

---

## 🔑 Configuration de la clé API
Au premier démarrage, l'application utilise une clé API partagée par défaut. Vous pouvez insérer votre propre clé API ImgChest dans le panneau **Configuration API** de la barre latérale gauche :
1. Entrez votre clé (cliquez sur l'œil pour l'afficher ou la masquer).
2. Cliquez sur **Enregistrer Permanent**.
3. Vos paramètres seront enregistrés dans le fichier local `config.json` et chargés automatiquement à chaque démarrage !

---

## 🛠️ Développement (Modification de l'interface)

Si vous souhaitez modifier le design ou le comportement de l'interface React :
1. Naviguez dans le dossier `frontend` :
   ```bash
   cd frontend
   ```
2. Installez les packages Node.js :
   ```bash
   npm install
   ```
3. Démarrez le serveur de développement Vite :
   ```bash
   npm run dev
   ```
4. Lancez le backend Python en mode dev pour vous connecter au serveur à chaud :
   ```bash
   python imgchest_uploader.py --dev
   ```
5. Une fois vos modifications prêtes, compilez le frontend de production :
   ```bash
   npm run build
   ```

---

## 📜 Licence

Ce projet est distribué sous licence **MIT**. Voir le fichier [LICENSE](LICENSE) pour plus de détails. Rendu 100% open-source pour la communauté !
